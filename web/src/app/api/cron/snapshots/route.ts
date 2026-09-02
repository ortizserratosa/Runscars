import {
  runScheduledSnapshotsV2,
  SupabaseSnapshotSchedulerRepository,
} from "../../../../lib/snapshots/scheduler";

export const maxDuration = 60;

export async function GET(request: Request) {
  const expectedSecret = process.env.CRON_SECRET;
  const authorization = request.headers.get("authorization");
  if (
    !expectedSecret ||
    expectedSecret.length < 16 ||
    authorization !== `Bearer ${expectedSecret}`
  ) {
    return Response.json({ error: "No autorizado" }, { status: 401 });
  }

  const repository = new SupabaseSnapshotSchedulerRepository();
  const startedAt = new Date().toISOString();
  const trigger = request.headers
    .get("user-agent")
    ?.toLocaleLowerCase("en")
    .includes("vercel-cron")
    ? "scheduled"
    : "manual";
  let runId: number | null = null;
  try {
    const currentRunId = await repository.beginRefreshRun(startedAt, trigger);
    runId = currentRunId;
    const results = await runScheduledSnapshotsV2(repository);
    const failed = results.filter(
      (result) => result.status === "failed",
    ).length;
    const created = results.filter(
      (result) => result.status === "created",
    ).length;
    const unchanged = results.filter(
      (result) => result.status === "unchanged",
    ).length;
    const skipped = results.filter(
      (result) => result.status === "skipped",
    ).length;
    await repository.finishRefreshRun(currentRunId, {
      status: failed === 0 ? "succeeded" : "partial",
      finishedAt: new Date().toISOString(),
      schedulesSeen: results.length,
      snapshotsCreated: created,
      snapshotsUnchanged: unchanged,
      schedulesSkipped: skipped,
      schedulesFailed: failed,
      details: results,
    });
    return Response.json(
      {
        status: failed === 0 ? "succeeded" : "partial",
        schedules: results.length,
        failed,
        results,
      },
      { status: failed === results.length && failed > 0 ? 500 : 200 },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Fallo interno de snapshots";
    if (runId !== null) {
      await repository
        .finishRefreshRun(runId, {
          status: "failed",
          finishedAt: new Date().toISOString(),
          schedulesSeen: 0,
          snapshotsCreated: 0,
          snapshotsUnchanged: 0,
          schedulesSkipped: 0,
          schedulesFailed: 0,
          errorSummary: message,
          details: [],
        })
        .catch(() => undefined);
    }
    return Response.json(
      {
        status: "failed",
        error: message,
      },
      { status: 500 },
    );
  }
}
