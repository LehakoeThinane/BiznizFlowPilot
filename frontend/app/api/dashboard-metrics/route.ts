import { NextRequest, NextResponse } from "next/server";

const BACKEND_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000";

interface BackendMetricsResponse {
  runs: {
    running: number;
  };
}

interface BackendListResponse {
  total: number;
}

export async function GET(request: NextRequest) {
  const authorization = request.headers.get("authorization");
  if (!authorization) {
    return NextResponse.json(
      { detail: "Missing Authorization header" },
      { status: 401 },
    );
  }

  try {
    const headers = {
      Authorization: authorization,
      Accept: "application/json",
    };

    const [metricsResponse, workflowsResponse, leadsResponse, tasksResponse] = await Promise.all([
      fetch(`${BACKEND_BASE_URL}/api/v1/metrics`, {
        method: "GET",
        headers,
        cache: "no-store",
      }),
      fetch(`${BACKEND_BASE_URL}/api/v1/workflows?skip=0&limit=1`, {
        method: "GET",
        headers,
        cache: "no-store",
      }),
      fetch(`${BACKEND_BASE_URL}/api/v1/leads?skip=0&limit=1`, {
        method: "GET",
        headers,
        cache: "no-store",
      }),
      fetch(`${BACKEND_BASE_URL}/api/v1/tasks?skip=0&limit=1&status=pending`, {
        method: "GET",
        headers,
        cache: "no-store",
      }),
    ]);

    if (
      !metricsResponse.ok ||
      !workflowsResponse.ok ||
      !leadsResponse.ok ||
      !tasksResponse.ok
    ) {
      const status =
        [
          metricsResponse.status,
          workflowsResponse.status,
          leadsResponse.status,
          tasksResponse.status,
        ].find(
          (code) => code >= 400 && code < 500,
        ) ?? 502;
      return NextResponse.json(
        { detail: "Failed to fetch dashboard metrics from backend" },
        { status },
      );
    }

    const [metrics, workflows, leads, tasks] = (await Promise.all([
      metricsResponse.json(),
      workflowsResponse.json(),
      leadsResponse.json(),
      tasksResponse.json(),
    ])) as [
      BackendMetricsResponse,
      BackendListResponse,
      BackendListResponse,
      BackendListResponse,
    ];

    return NextResponse.json({
      totalWorkflows: workflows.total,
      activeRuns: metrics.runs.running,
      pendingTasks: tasks.total,
      totalLeads: leads.total,
      refreshedAt: new Date().toISOString(),
    });
  } catch {
    return NextResponse.json(
      { detail: "Unable to load dashboard metrics" },
      { status: 502 },
    );
  }
}
