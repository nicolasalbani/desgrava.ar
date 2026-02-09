"use client";

import { useState, useEffect, useRef } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2, Camera, Play, ChevronLeft, ChevronRight } from "lucide-react";

interface ScreenshotInfo {
  step: number;
  name: string;
  label: string;
  timestamp: string;
  url: string;
}

interface JobInfo {
  id: string;
  status: string;
  screenshotUrl: string | null;
  logs: string[];
}

export function JobDetail({ jobId }: { jobId: string }) {
  const [job, setJob] = useState<JobInfo | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [screenshots, setScreenshots] = useState<ScreenshotInfo[]>([]);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [streaming, setStreaming] = useState(true);
  const [expandedScreenshot, setExpandedScreenshot] =
    useState<ScreenshotInfo | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
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

      if (data.screenshot) {
        setScreenshots((prev) => {
          if (prev.some((s) => s.step === data.screenshot.step)) return prev;
          return [...prev, data.screenshot];
        });
      }

      if (data.done) {
        setStreaming(false);
        if (data.videoUrl) {
          setVideoUrl(data.videoUrl);
        }
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
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  useEffect(() => {
    if (timelineRef.current) {
      timelineRef.current.scrollLeft = timelineRef.current.scrollWidth;
    }
  }, [screenshots]);

  function scrollTimeline(direction: "left" | "right") {
    if (!timelineRef.current) return;
    timelineRef.current.scrollBy({
      left: direction === "left" ? -200 : 200,
      behavior: "smooth",
    });
  }

  if (!job) {
    return (
      <div className="flex justify-center py-6">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Status bar */}
      <div className="flex items-center gap-2">
        <Badge variant="outline">{job.status}</Badge>
        {streaming && (
          <span className="flex items-center gap-1 text-sm text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" />
            En vivo
          </span>
        )}
      </div>

      {/* Screenshot timeline */}
      {screenshots.length > 0 && (
        <div>
          <h4 className="font-medium mb-2 flex items-center gap-2">
            <Camera className="h-4 w-4" />
            Capturas ({screenshots.length})
          </h4>
          <div className="relative">
            {screenshots.length > 3 && (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute left-0 top-1/2 -translate-y-1/2 z-10 bg-background/80"
                  onClick={() => scrollTimeline("left")}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-1/2 -translate-y-1/2 z-10 bg-background/80"
                  onClick={() => scrollTimeline("right")}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </>
            )}
            <div
              ref={timelineRef}
              className="flex gap-3 overflow-x-auto pb-2 px-1"
            >
              {screenshots.map((ss) => (
                <button
                  key={ss.step}
                  className="flex-shrink-0 cursor-pointer text-left"
                  onClick={() => setExpandedScreenshot(ss)}
                >
                  <div className="w-48 border rounded-md overflow-hidden hover:ring-2 hover:ring-primary transition-all">
                    <img
                      src={ss.url}
                      alt={ss.label}
                      className="w-full h-28 object-cover object-top"
                      loading="lazy"
                    />
                  </div>
                  <div className="mt-1 text-xs text-center">
                    <span className="font-medium text-muted-foreground">
                      Paso {ss.step}
                    </span>
                    <p className="text-muted-foreground truncate w-48">
                      {ss.label}
                    </p>
                  </div>
                </button>
              ))}
              {streaming && (
                <div className="flex-shrink-0 w-48 h-28 border rounded-md flex items-center justify-center border-dashed">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Video player */}
      {videoUrl && (
        <div>
          <h4 className="font-medium mb-2 flex items-center gap-2">
            <Play className="h-4 w-4" />
            Grabacion de sesion
          </h4>
          <div className="border rounded-md overflow-hidden">
            <video
              controls
              className="w-full"
              src={videoUrl}
              preload="metadata"
            >
              Tu navegador no soporta video HTML5.
            </video>
          </div>
        </div>
      )}

      {/* Fallback: legacy single screenshot for old jobs */}
      {screenshots.length === 0 && job.screenshotUrl && (
        <div className="border rounded-md overflow-hidden">
          <img
            src={job.screenshotUrl}
            alt="Preview de SiRADIG"
            className="w-full"
          />
        </div>
      )}

      {/* Log stream */}
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

      {/* Expanded screenshot dialog */}
      <Dialog
        open={!!expandedScreenshot}
        onOpenChange={(open) => !open && setExpandedScreenshot(null)}
      >
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>
              {expandedScreenshot &&
                `Paso ${expandedScreenshot.step}: ${expandedScreenshot.label}`}
            </DialogTitle>
          </DialogHeader>
          {expandedScreenshot && (
            <img
              src={expandedScreenshot.url}
              alt={expandedScreenshot.label}
              className="w-full border rounded"
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
