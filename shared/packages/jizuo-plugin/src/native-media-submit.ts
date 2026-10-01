import type { ComposerSubmissionRoute } from "../../jizuo-client/src/video/main-video-composer.ts";

type Attempt = { signal: AbortSignal };
type Core = {
  phase: string;
  claim: unknown;
  beginAttempt(mode: string, draft: string, submission?: unknown): Attempt;
  onEnter(mode: string, draft: string, submission?: unknown): unknown[];
};
type Shell = {
  submit(mode?: string, source?: unknown): void;
  notify(level: "error", text: string): void;
  state: { getSnapshot(): { phase: string } };
  disposed?: boolean;
  projection: { clipboardText: string; detectText: string };
  core: Core;
  dispatchRun(event: unknown): void;
};

/**
 * Desktop 0.2 has no model-selected submit hook. Adapt its resident input shell
 * to the existing frozen transaction, rather than sending via the text sink or
 * modifying the installed host bundle. Keep this compatibility boundary small:
 * both Enter and the native button call this same shell, including image-only
 * drafts. The host still owns attachment serialization, draft recovery and
 * attempt cancellation. Covered against the unmodified Desktop browser factory.
 */
export function bindNativeMediaSubmit(input: unknown, resolve: () => ComposerSubmissionRoute | undefined): () => void {
  const shell = input as Shell;
  const originalSubmit = shell.submit;
  const core = shell.core;
  const originalEnter = core?.onEnter;
  const compatible = typeof originalSubmit === "function" && typeof originalEnter === "function"
    && typeof core.beginAttempt === "function" && typeof shell.dispatchRun === "function"
    && typeof shell.projection?.clipboardText === "string";
  let activeRoute: ComposerSubmissionRoute | undefined;
  const enter: Core["onEnter"] = function (this: Core, mode, draft, submission) {
    if (!activeRoute) return originalEnter.call(this, mode, draft, submission);
    const route = activeRoute;
    const attempt = this.beginAttempt(mode, draft, submission);
    this.claim = undefined;
    this.phase = "submitting";
    return [{ type: "begin-submit", attempt, args: draft, claim: {
      attachments: true,
      submit: (_args: string, _context: unknown, attachments: Parameters<ComposerSubmissionRoute["submit"]>[1]) => route.submit(attempt.signal, attachments),
    } }];
  };
  const submit: Shell["submit"] = function (this: Shell, mode = "queue", source) {
    if (shell.disposed || ["submitting", "adjudicating"].includes(shell.state.getSnapshot().phase)) return;
    try {
      const route = resolve();
      if (!route) { originalSubmit.call(this, mode, source); return; }
      if (!compatible) throw new Error("当前 DSH 版本暂不支持媒体提交，请更新即作媒体模型插件后重试");
      activeRoute = route;
      shell.dispatchRun({ type: "enter", mode, draft: shell.projection.clipboardText });
    } catch (error) {
      shell.notify("error", error instanceof Error ? error.message : "生成入口暂不可用，请重新选择模型");
    } finally { activeRoute = undefined; }
  };
  if (compatible) core.onEnter = enter;
  shell.submit = submit;
  return () => {
    if (shell.submit === submit) shell.submit = originalSubmit;
    if (compatible && core.onEnter === enter) core.onEnter = originalEnter;
  };
}
