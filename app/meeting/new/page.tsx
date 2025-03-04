"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { toast, Toaster } from "react-hot-toast";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function NewMeetingPage() {
  const [meetingName, setMeetingName] = useState("");
  const [recording, setRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [fileSize, setFileSize] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunks = useRef<Blob[]>([]);
  const router = useRouter();
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0); // NEW: Upload Progress

  useEffect(() => {
    if (recording) {
      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [recording]);

  const startRecording = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRecorderRef.current = new MediaRecorder(stream);

    mediaRecorderRef.current.ondataavailable = (event) => {
      if (event.data.size > 0) {
        audioChunks.current.push(event.data);
        setFileSize((prev) => prev + event.data.size);
      }
    };

    mediaRecorderRef.current.onstop = async () => {
      const audioBlob = new Blob(audioChunks.current, { type: "audio/wav" });
      audioChunks.current = [];
      await uploadAudioToSupabase(audioBlob);
    };

    mediaRecorderRef.current.start(1000);
    setRecording(true);
    setRecordingTime(0);
    setFileSize(0);
  };

  const uploadAudioToSupabase = async (audioBlob: Blob) => {
    const fileName = `${Date.now()}-${meetingName.replace(/\s+/g, "_")}.wav`;
    setUploadProgress(0); // Reset progress
    const totalSize = audioBlob.size;
    let uploadedSize = 0;
    const reader = audioBlob.stream().getReader();
    const chunks: Uint8Array[] = [];

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      uploadedSize += value.length;

      // Update progress
      setUploadProgress(Math.round((uploadedSize / totalSize) * 100));
    }

    const { data, error } = await supabase.storage
      .from("meeting-recordings")
      .upload(fileName, new Blob(chunks), { contentType: "audio/wav" });
    setUploadProgress(100); // Ensure progress is complete

    if (error) {
      console.error("Error uploading file to Supabase:", error);
      return "";
    }
    const url = supabase.storage
      .from("meeting-recordings")
      .getPublicUrl(data.path).data.publicUrl;
    await saveRecordingToDatabase(fileName, url);
    return url;
  };

  const saveRecordingToDatabase = async (fileName: string, fileUrl: string) => {
    const { data, error } = await supabase
      .from("meetings")
      .insert([
        {
          name: meetingName,
          audio_url: fileUrl,
          transcription: "", // Initially empty
        },
      ])
      .select();

    if (error) {
      console.error("Error saving recording to database:", error);
      toast.error("Failed to save meeting.");
    } else if (data && data.length > 0) {
      toast.success("Recording uploaded successfully!", {
        duration: 2000,
      });
      setTimeout(() => {
        router.push(`/meeting/${data[0].id}`);
      }, 2000);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      setRecording(false);
    }
  };

  return (
    <>
      <Toaster />
      <div className="p-6 max-w-xl mx-auto">
        <input
          type="text"
          placeholder="Enter meeting name"
          className="w-full p-2 border rounded"
          value={meetingName}
          onChange={(e) => setMeetingName(e.target.value)}
        />
        <div className="mt-4 flex gap-2">
          <Button onClick={startRecording} disabled={recording}>
            Start Recording
          </Button>
          <Button onClick={stopRecording} disabled={!recording}>
            Stop Recording
          </Button>
        </div>

        {recording && (
          <div className="mt-4 text-gray-600">
            Recording Time: {recordingTime} sec | File Size:{" "}
            {(fileSize / 1024).toFixed(2)} KB
          </div>
        )}

        {/* Progress Bar */}
        {uploadProgress > 0 && (
          <div className="mt-4">
            <p className="text-sm text-gray-600">
              Uploading: {uploadProgress}%
            </p>
            <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
              <div
                className="bg-blue-500 h-2 rounded-full transition-all duration-500"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
          </div>
        )}
      </div>
    </>
  );
}
