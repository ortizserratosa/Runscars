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

  try {
    const results = await runScheduledSnapshotsV2(
      new SupabaseSnapshotSchedulerRepository(),
    );
    const failed = results.filter(
      (result) => result.status === "failed",
    ).length;
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
    return Response.json(
      {
        status: "failed",
        error:
          error instanceof Error ? error.message : "Fallo interno de snapshots",
      },
      { status: 500 },
    );
  }
}
