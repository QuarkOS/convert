import type { FormatId } from "../domain.ts";
import { ConversionError } from "../domain.ts";
import { Pairs } from "../pairs.ts";
import { BinaryProbe, ProcessRun, TempDir } from "../process-run.ts";

const AUDIO = ["mp3", "wav", "flac", "ogg", "m4a"] as const satisfies readonly FormatId[];
const VIDEO = ["mp4", "webm", "mov", "gif"] as const satisfies readonly FormatId[];

export class FfmpegEngine {
  static readonly id = "ffmpeg";

  static available(): boolean {
    return BinaryProbe.has("ffmpeg");
  }

  static edges(): { from: FormatId; to: FormatId }[] {
    return [...Pairs.directed(AUDIO), ...Pairs.directed(VIDEO)];
  }

  static async convert(input: Uint8Array, from: FormatId, to: FormatId): Promise<Uint8Array> {
    return TempDir.use(async (dir) => {
      const source = await TempDir.write(dir, `in.${from}`, input);
      const target = `${dir}/out.${to}`;
      await ProcessRun.exec("ffmpeg", ["-y", "-hide_banner", "-loglevel", "error", "-i", source, ...FfmpegEngine.args(to), target]);
      return TempDir.read(target);
    });
  }

  private static args(to: FormatId): string[] {
    if (to === "mp3") return ["-c:a", "libmp3lame"];
    if (to === "wav") return ["-c:a", "pcm_s16le"];
    if (to === "flac") return ["-c:a", "flac"];
    if (to === "ogg") return ["-c:a", "libvorbis"];
    if (to === "m4a") return ["-c:a", "aac"];
    if (to === "mp4" || to === "mov") return ["-c:v", "libx264", "-pix_fmt", "yuv420p"];
    if (to === "webm") return ["-c:v", "libvpx-vp9", "-crf", "40", "-b:v", "0"];
    if (to === "gif") return [];
    throw new ConversionError("engine-failed", `ffmpeg cannot write ${to}`);
  }
}
