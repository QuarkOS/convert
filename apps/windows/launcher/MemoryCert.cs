using System;
using System.Collections.Generic;
using System.IO;
using Org.BouncyCastle.Asn1;
using Org.BouncyCastle.Asn1.Nist;
using Org.BouncyCastle.Asn1.Oiw;
using Org.BouncyCastle.Asn1.Pkcs;
using Org.BouncyCastle.Asn1.X509;
using Org.BouncyCastle.Crypto;
using Org.BouncyCastle.Crypto.Generators;
using Org.BouncyCastle.Crypto.Operators;
using Org.BouncyCastle.Math;
using Org.BouncyCastle.Pkcs;
using Org.BouncyCastle.Security;
using Org.BouncyCastle.X509;

public class MemoryCert {
  public static int Main(string[] args) {
    if (args.Length != 2) return 2;
    string path = args[0];
    string password = args[1];
    SecureRandom random = new SecureRandom();
    RsaKeyPairGenerator generator = new RsaKeyPairGenerator();
    generator.Init(new KeyGenerationParameters(random, 2048));
    AsymmetricCipherKeyPair pair = generator.GenerateKeyPair();
    X509Name name = new X509Name("CN=Convert");
    X509V3CertificateGenerator certGen = new X509V3CertificateGenerator();
    certGen.SetSerialNumber(BigInteger.One);
    certGen.SetIssuerDN(name);
    certGen.SetSubjectDN(name);
    certGen.SetNotBefore(DateTime.UtcNow.AddDays(-1));
    certGen.SetNotAfter(DateTime.UtcNow.AddDays(2));
    certGen.SetPublicKey(pair.Public);
    certGen.AddExtension(X509Extensions.KeyUsage, true, new KeyUsage(KeyUsage.DigitalSignature));
    certGen.AddExtension(X509Extensions.ExtendedKeyUsage, false, new ExtendedKeyUsage(KeyPurposeID.id_kp_codeSigning));
    certGen.AddExtension(X509Extensions.BasicConstraints, true, new BasicConstraints(false));
    X509Certificate cert = certGen.Generate(new Asn1SignatureFactory("SHA256WITHRSA", pair.Private, random));
    byte[] localKeyId = DigestUtilities.CalculateDigest("SHA1", cert.GetEncoded());
    Pkcs12StoreBuilder builder = new Pkcs12StoreBuilder();
    builder.SetUseDerEncoding(true);
    builder.SetKeyAlgorithm(NistObjectIdentifiers.IdAes256Cbc, PkcsObjectIdentifiers.IdHmacWithSha256);
    // 2.4.0 emits PBES2 only for the key bag. The default cert bag is
    // pbeWithSHA1And40BitRC2-CBC. Leave the cert bag as PKCS#7 data.
    builder.SetCertAlgorithm(null);
    Pkcs12Store store = builder.Build();
    store.SetKeyEntry("convert", new AsymmetricKeyEntry(pair.Private, MemoryCert.BagAttributes(localKeyId, true)), new X509CertificateEntry[] {
      new X509CertificateEntry(cert, MemoryCert.BagAttributes(localKeyId, false))
    });
    byte[] encoded;
    using (MemoryStream buffer = new MemoryStream()) {
      store.Save(buffer, password.ToCharArray(), random);
      encoded = buffer.ToArray();
    }
    // Pkcs12Store writes the key safe before the certificate safe. Windows
    // imports that certificate and then drops it in the private-key filter.
    File.WriteAllBytes(path, MemoryCert.CertificatesBeforeKeys(encoded, password.ToCharArray(), pair.Private, random));
    File.WriteAllBytes(Path.ChangeExtension(path, ".cer"), cert.GetEncoded());
    Console.WriteLine(cert.SubjectDN.ToString());
    return 0;
  }

  static byte[] CertificatesBeforeKeys(byte[] encoded, char[] password, AsymmetricKeyParameter privateKey, SecureRandom random) {
    EncryptedPrivateKeyInfo signatureKey = MemoryCert.SignatureKey(privateKey, password, random);
    Pfx pfx = Pfx.GetInstance(Asn1Object.FromByteArray(encoded));
    byte[] safeBytes = Asn1OctetString.GetInstance(pfx.AuthSafe.Content).GetOctets();
    Asn1Sequence safes = Asn1Sequence.GetInstance(Asn1Object.FromByteArray(safeBytes));
    ContentInfo certificateSafe = null;
    ContentInfo keySafe = null;
    Asn1EncodableVector other = new Asn1EncodableVector();
    for (int i = 0; i < safes.Count; i++) {
      ContentInfo safe = ContentInfo.GetInstance(safes[i]);
      bool wasKey;
      bool wasCert;
      ContentInfo updated = MemoryCert.ReplaceSignatureKey(safe, signatureKey, out wasKey, out wasCert);
      if (wasKey) keySafe = updated;
      else if (wasCert) certificateSafe = updated;
      else other.Add(updated);
    }
    Asn1EncodableVector order = new Asn1EncodableVector();
    if (certificateSafe != null) order.Add(certificateSafe);
    if (keySafe != null) order.Add(keySafe);
    for (int i = 0; i < other.Count; i++) order.Add(other[i]);
    byte[] reordered = new DerSequence(order).GetDerEncoded();
    ContentInfo swapped = new ContentInfo(pfx.AuthSafe.ContentType, new DerOctetString(reordered));
    int iterations = pfx.MacData.IterationCount.IntValue;
    byte[] digest = MemoryCert.PbeMac(password, pfx.MacData.GetSalt(), iterations, reordered);
    AlgorithmIdentifier sha1 = new AlgorithmIdentifier(OiwObjectIdentifiers.IdSha1, DerNull.Instance);
    MacData mac = new MacData(new DigestInfo(sha1, digest), pfx.MacData.GetSalt(), iterations);
    return new Pfx(swapped, mac).GetDerEncoded();
  }

  static EncryptedPrivateKeyInfo SignatureKey(AsymmetricKeyParameter privateKey, char[] password, SecureRandom random) {
    DerBitString usage = new DerBitString(new byte[] { (byte)0x80 });
    AttributePkcs attribute = new AttributePkcs(X509Extensions.KeyUsage, new DerSet(usage));
    PrivateKeyInfo info = PrivateKeyInfoFactory.CreatePrivateKeyInfo(privateKey, new DerSet(attribute));
    byte[] salt = new byte[20];
    random.NextBytes(salt);
    return EncryptedPrivateKeyInfoFactory.CreateEncryptedPrivateKeyInfo(
      NistObjectIdentifiers.IdAes256Cbc,
      PkcsObjectIdentifiers.IdHmacWithSha256,
      password,
      salt,
      1024,
      random,
      info);
  }

  static ContentInfo ReplaceSignatureKey(ContentInfo safe, EncryptedPrivateKeyInfo signatureKey, out bool wasKey, out bool wasCert) {
    wasKey = false;
    wasCert = false;
    byte[] inner = Asn1OctetString.GetInstance(safe.Content).GetOctets();
    Asn1Sequence bags = Asn1Sequence.GetInstance(Asn1Object.FromByteArray(inner));
    Asn1EncodableVector rebuilt = new Asn1EncodableVector();
    bool changed = false;
    for (int i = 0; i < bags.Count; i++) {
      SafeBag bag = SafeBag.GetInstance(bags[i]);
      if (PkcsObjectIdentifiers.Pkcs8ShroudedKeyBag.Equals(bag.BagID)) {
        wasKey = true;
        changed = true;
        rebuilt.Add(new SafeBag(bag.BagID, signatureKey.ToAsn1Object(), bag.BagAttributes));
      } else {
        if (PkcsObjectIdentifiers.CertBag.Equals(bag.BagID)) wasCert = true;
        rebuilt.Add(bag);
      }
    }
    if (!changed) return safe;
    return new ContentInfo(safe.ContentType, new DerOctetString(new DerSequence(rebuilt).GetDerEncoded()));
  }

  static byte[] PbeMac(char[] password, byte[] salt, int iterations, byte[] data) {
    DerObjectIdentifier sha1 = OiwObjectIdentifiers.IdSha1;
    Asn1Encodable parameters = PbeUtilities.GenerateAlgorithmParameters(sha1, salt, iterations);
    ICipherParameters key = PbeUtilities.GenerateCipherParameters(sha1, password, false, parameters);
    IMac mac = (IMac)PbeUtilities.CreateEngine(sha1);
    mac.Init(key);
    return MacUtilities.DoFinal(mac, data);
  }

  static Dictionary<DerObjectIdentifier, Asn1Encodable> BagAttributes(byte[] localKeyId, bool key) {
    Dictionary<DerObjectIdentifier, Asn1Encodable> attributes = new Dictionary<DerObjectIdentifier, Asn1Encodable>();
    attributes.Add(PkcsObjectIdentifiers.Pkcs9AtLocalKeyID, new DerOctetString(localKeyId));
    attributes.Add(PkcsObjectIdentifiers.Pkcs9AtFriendlyName, new DerBmpString("convert"));
    if (key) {
      attributes.Add(new DerObjectIdentifier("1.3.6.1.4.1.311.17.1"), new DerBmpString("Microsoft Enhanced RSA and AES Cryptographic Provider"));
    }
    return attributes;
  }
}
