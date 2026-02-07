"use client";

import { useState, useEffect, useRef } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";

interface JobInfo {
  id: string;
  status: string;
  screenshotUrl: string | null;
  logs: string[];
}

export function JobDetail({ jobId }: { jobId: string }) {
  const [job, setJob] = useState<JobInfo | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [streaming, setStreaming] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Fetch job info
    fetch(`/api/automatizacion/${jobId}`)
      .then((r) => r.json())
      .then((data) => {
        setJob(data.job);
        if (data.job.logs && Array.isArray(data.job.logs)) {
          setLogs(data.job.logs);
        }
      });
  }, [jobId]);

  useEffect(() => {
    // Connect to SSE for real-time logs
    if (!job) return;
    if (["COMPLETED", "FAILED", "CANCELLED"].includes(job.status)) {
      setStreaming(false);
      return;
    }

    const eventSource = new EventSource(
      `/api/automatizacion/${jobId}/logs`
    );

    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.log) {
        setLogs((prev) => [...prev, data.log]);
      }
      if (data.done) {
        setStreaming(false);
        eventSource.close();
      }
    };

    eventSource.onerror = () => {
      setStreaming(false);
      eventSource.close();
    };

    return () => eventSource.close();
  }, [job, jobId]);

  useEffect(() => {
    // Auto-scroll to bottom
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  if (!job) {
    return (
      <div className="flex justify-center py-6">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Badge variant="outline">{job.status}</Badge>
        {streaming && (
          <span className="flex items-center gap-1 text-sm text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" />
            En vivo
          </span>
        )}
      </div>

      {job.screenshotUrl && (
        <div className="border rounded-md overflow-hidden">
          <img
            src={job.screenshotUrl}
            alt="Preview de SiRADIG"
            className="w-full"
          />
        </div>
      )}

      <div>
        <h4 className="font-medium mb-2">Logs</h4>
        <ScrollArea className="h-[300px] border rounded-md">
          <div ref={scrollRef} className="p-3 font-mono text-xs space-y-1">
            {logs.length === 0 ? (
              <p className="text-muted-foreground">Esperando logs...</p>
            ) : (
              logs.map((log, i) => (
                <p key={i} className="text-muted-foreground">
                  {log}
                </p>
              ))
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
