import { describe, expect, it } from "vitest";
import { computeBallState } from "./BallWindow";

describe("computeBallState", () => {
  it("returns error when errorMessage is set (highest priority)", () => {
    expect(
      computeBallState("Recording", true, true, "Something went wrong"),
    ).toBe("error");
  });

  it("returns tts when ttsSpeaking is true", () => {
    expect(computeBallState("Idle", false, true, null)).toBe("tts");
  });

  it("returns tts even when rewriteMode is active", () => {
    expect(computeBallState("Idle", true, true, null)).toBe("tts");
  });

  it("returns rewrite when rewriteMode is true and status is Recording", () => {
    expect(computeBallState("Recording", true, false, null)).toBe("rewrite");
  });

  it("returns rewrite when rewriteMode is true and status is Recognizing", () => {
    expect(computeBallState("Recognizing", true, false, null)).toBe("rewrite");
  });

  it("returns rewrite when rewriteMode is true and status is Idle", () => {
    expect(computeBallState("Idle", true, false, null)).toBe("rewrite");
  });

  it("returns recording when status is Recording without rewriteMode", () => {
    expect(computeBallState("Recording", false, false, null)).toBe("recording");
  });

  it("returns thinking when status is Recognizing", () => {
    expect(computeBallState("Recognizing", false, false, null)).toBe("thinking");
  });

  it("returns thinking when status is Preview", () => {
    expect(computeBallState("Preview", false, false, null)).toBe("thinking");
  });

  it("returns disabled when status is Paused", () => {
    expect(computeBallState("Paused", false, false, null)).toBe("disabled");
  });

  it("returns idle for default status", () => {
    expect(computeBallState("Idle", false, false, null)).toBe("idle");
  });
});
