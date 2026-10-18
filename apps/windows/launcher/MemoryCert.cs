using System;
using System.IO;
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
    certGen.AddExtension(X509Extensions.KeyUsage, false, new KeyUsage(KeyUsage.DigitalSignature));
    certGen.AddExtension(X509Extensions.ExtendedKeyUsage, false, new ExtendedKeyUsage(KeyPurposeID.IdKPCodeSigning));
    X509Certificate cert = certGen.Generate(new Asn1SignatureFactory("SHA256WITHRSA", pair.Private, random));
    Pkcs12Store store = new Pkcs12Store();
    store.SetKeyEntry("convert", new AsymmetricKeyEntry(pair.Private), new X509CertificateEntry[] { new X509CertificateEntry(cert) });
    using (FileStream stream = File.Create(path)) {
      store.Save(stream, password.ToCharArray(), random);
    }
    File.WriteAllBytes(Path.ChangeExtension(path, ".cer"), cert.GetEncoded());
    Console.WriteLine("CN=Convert");
    return 0;
  }
}
