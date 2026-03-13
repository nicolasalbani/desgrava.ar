"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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

const TERMINAL_STATUSES = ["COMPLETED", "FAILED", "CANCELLED"];

export function JobDetail({ jobId }: { jobId: string }) {
  const [job, setJob] = useState<JobInfo | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [screenshots, setScreenshots] = useState<ScreenshotInfo[]>([]);
  const [videoUrls, setVideoUrls] = useState<string[]>([]);
  const [activeVideoIndex, setActiveVideoIndex] = useState(0);
  const [videoErrors, setVideoErrors] = useState<Set<string>>(new Set());
  const [streaming, setStreaming] = useState(true);
  const [expandedScreenshot, setExpandedScreenshot] = useState<ScreenshotInfo | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const jobLoadedRef = useRef(false);
  const initialStatusRef = useRef<string | null>(null);

  // Fetch initial job data including screenshots and video
  useEffect(() => {
    jobLoadedRef.current = false;
    fetch(`/api/automatizacion/${jobId}`)
      .then((r) => r.json())
      .then((data) => {
        setJob(data.job);
        initialStatusRef.current = data.job.status;

        if (data.job.logs && Array.isArray(data.job.logs)) {
          setLogs(data.job.logs);
        }
        if (data.screenshots && Array.isArray(data.screenshots)) {
          setScreenshots(data.screenshots);
        }
        if (data.videoUrls && Array.isArray(data.videoUrls)) {
          setVideoUrls(data.videoUrls);
        }

        // If already in terminal state, no streaming needed
        if (TERMINAL_STATUSES.includes(data.job.status)) {
          setStreaming(false);
        }

        jobLoadedRef.current = true;
      });
  }, [jobId]);

  // SSE for real-time updates (only for non-terminal jobs)
  const connectSSE = useCallback(() => {
    if (!jobLoadedRef.current || !initialStatusRef.current) return undefined;
    if (TERMINAL_STATUSES.includes(initialStatusRef.current)) return undefined;

    const eventSource = new EventSource(`/api/automatizacion/${jobId}/logs`);

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

      // Update status in real-time (PENDING → RUNNING, etc.)
      if (data.status) {
        setJob((prev) => (prev ? { ...prev, status: data.status } : prev));
      }

      if (data.done) {
        setStreaming(false);
        if (data.videoUrls && Array.isArray(data.videoUrls)) {
          setVideoUrls(data.videoUrls);
        }
        if (data.status) {
          setJob((prev) => (prev ? { ...prev, status: data.status } : prev));
        }
        eventSource.close();
      }
    };

    eventSource.onerror = () => {
      setStreaming(false);
      eventSource.close();
    };

    return eventSource;
  }, [jobId]);

  useEffect(() => {
    if (!job) return;
    const eventSource = connectSSE();
    return () => eventSource?.close();
  }, [job !== null, connectSSE]); // eslint-disable-line react-hooks/exhaustive-deps

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

  const playableVideos = videoUrls.filter((url) => !videoErrors.has(url));

  if (!job) {
    return (
      <div className="flex justify-center py-6">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-w-0 space-y-4 overflow-hidden">
      {/* Status bar */}
      <div className="flex items-center gap-2">
        <Badge variant="outline">{job.status}</Badge>
        {streaming && (
          <span className="text-muted-foreground flex items-center gap-1 text-sm">
            <Loader2 className="h-3 w-3 animate-spin" />
            En vivo
          </span>
        )}
      </div>

      {/* Screenshot timeline */}
      {(screenshots.length > 0 || streaming) && (
        <div>
          <h4 className="mb-2 flex items-center gap-2 font-medium">
            <Camera className="h-4 w-4" />
            Capturas ({screenshots.length})
          </h4>
          <div className="relative">
            {screenshots.length > 3 && (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  className="bg-background/80 absolute top-1/2 left-0 z-10 -translate-y-1/2"
                  onClick={() => scrollTimeline("left")}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="bg-background/80 absolute top-1/2 right-0 z-10 -translate-y-1/2"
                  onClick={() => scrollTimeline("right")}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </>
            )}
            <div ref={timelineRef} className="flex gap-3 overflow-x-auto px-1 pb-2">
              {screenshots.map((ss) => (
                <button
                  key={ss.step}
                  className="flex-shrink-0 cursor-pointer text-left"
                  onClick={() => setExpandedScreenshot(ss)}
                >
                  <div className="hover:ring-primary w-48 overflow-hidden rounded-md border transition-all hover:ring-2">
                    <img
                      src={ss.url}
                      alt={ss.label}
                      className="h-28 w-full object-cover object-top"
                      loading="lazy"
                    />
                  </div>
                  <div className="mt-1 text-center text-xs">
                    <span className="text-muted-foreground font-medium">Paso {ss.step}</span>
                    <p className="text-muted-foreground w-48 truncate">{ss.label}</p>
                  </div>
                </button>
              ))}
              {streaming && (
                <div className="flex h-28 w-48 flex-shrink-0 items-center justify-center rounded-md border border-dashed">
                  <Loader2 className="text-muted-foreground h-5 w-5 animate-spin" />
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Video player / carousel */}
      {playableVideos.length > 0 && (
        <div>
          <h4 className="mb-2 flex items-center gap-2 font-medium">
            <Play className="h-4 w-4" />
            Grabacion de sesion
            {playableVideos.length > 1 && (
              <span className="text-muted-foreground text-sm font-normal">
                ({activeVideoIndex + 1} de {playableVideos.length})
              </span>
            )}
          </h4>
          <div className="relative overflow-hidden rounded-md border">
            <video
              key={playableVideos[activeVideoIndex]}
              controls
              className="w-full"
              src={playableVideos[activeVideoIndex]}
              preload="metadata"
              onError={() => {
                const failedUrl = playableVideos[activeVideoIndex];
                setVideoErrors((prev) => new Set(prev).add(failedUrl));
                if (activeVideoIndex > 0) {
                  setActiveVideoIndex((i) => i - 1);
                }
              }}
            >
              Tu navegador no soporta video HTML5.
            </video>
            {playableVideos.length > 1 && (
              <div className="bg-muted/50 flex justify-center gap-2 py-2">
                <Button
                  variant="ghost"
                  size="icon"
                  disabled={activeVideoIndex === 0}
                  onClick={() => setActiveVideoIndex((i) => i - 1)}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  disabled={activeVideoIndex === playableVideos.length - 1}
                  onClick={() => setActiveVideoIndex((i) => i + 1)}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Fallback: legacy single screenshot for old jobs */}
      {screenshots.length === 0 && job.screenshotUrl && (
        <div className="overflow-hidden rounded-md border">
          <img src={job.screenshotUrl} alt="Preview de SiRADIG" className="w-full" />
        </div>
      )}

      {/* Log stream */}
      <div>
        <h4 className="mb-2 font-medium">Logs</h4>
        <ScrollArea className="h-[300px] rounded-md border">
          <div ref={scrollRef} className="space-y-1 p-3 font-mono text-xs">
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
              {expandedScreenshot && `Paso ${expandedScreenshot.step}: ${expandedScreenshot.label}`}
            </DialogTitle>
          </DialogHeader>
          {expandedScreenshot && (
            <img
              src={expandedScreenshot.url}
              alt={expandedScreenshot.label}
              className="w-full rounded border"
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
