using System;
using System.Diagnostics;
using System.IO;
using System.Windows.Forms;

static class ConvertLauncher {
  [STAThread]
  static int Main(string[] args) {
    string node = FindNode();
    string host = FindHost();
    if (node == null || host == null) {
      MessageBox.Show("Convert could not find Node.js next to this app.", "Convert");
      return 1;
    }
    bool hasFile = false;
    foreach (string arg in args) {
      if (!arg.StartsWith("--") && File.Exists(arg)) hasFile = true;
    }
    if (!hasFile && args.Length == 0) {
      MessageBox.Show("No file is selected.", "Convert");
      return 2;
    }
    var start = new ProcessStartInfo();
    start.FileName = node;
    start.Arguments = "--disable-warning=ExperimentalWarning --experimental-strip-types \"" + host + "\" " + JoinArgs(args);
    start.UseShellExecute = false;
    start.CreateNoWindow = true;
    using (Process process = Process.Start(start)) {
      process.WaitForExit();
      return process.ExitCode;
    }
  }

  static string JoinArgs(string[] args) {
    string joined = "";
    foreach (string arg in args) {
      if (joined.Length > 0) joined += " ";
      joined += "\"" + arg.Replace("\"", "\\\"") + "\"";
    }
    return joined;
  }

  static string FindNode() {
    string env = Environment.GetEnvironmentVariable("CONVERT_NODE");
    if (!string.IsNullOrEmpty(env) && File.Exists(env)) return env;
    string path = Environment.GetEnvironmentVariable("PATH") ?? "";
    foreach (string dir in path.Split(';')) {
      string candidate = Path.Combine(dir.Trim(), "node.exe");
      if (File.Exists(candidate)) return candidate;
    }
    return null;
  }

  static string FindHost() {
    string dir = AppDomain.CurrentDomain.BaseDirectory;
    string[] candidates = new string[] {
      Path.Combine(dir, "host.ts"),
      Path.Combine(dir, "src", "host.ts"),
      Path.GetFullPath(Path.Combine(dir, "..", "src", "host.ts"))
    };
    foreach (string candidate in candidates) {
      if (File.Exists(candidate)) return candidate;
    }
    return null;
  }
}
