"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function HomePage() {
  const [meetings, setMeetings] = useState<
    { id: number; name: string; created_at: string }[]
  >([]);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const router = useRouter();

  const fetchMeetings = useCallback(async () => {
    const startOfDay = new Date(
      selectedDate.setHours(0, 0, 0, 0)
    ).toISOString();
    const endOfDay = new Date(
      selectedDate.setHours(23, 59, 59, 999)
    ).toISOString();

    const { data, error } = await supabase
      .from("meetings")
      .select("*")
      .gte("created_at", startOfDay)
      .lte("created_at", endOfDay)
      .order("created_at", { ascending: false });

    if (!error) setMeetings(data);
  }, [selectedDate]);

  useEffect(() => {
    fetchMeetings();
  }, [fetchMeetings, selectedDate]);

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold">Meeting Records</h1>
      <div className="flex items-center gap-4 mt-4">
        <DatePicker
          selected={selectedDate}
          onChange={(date) => setSelectedDate(date || new Date())}
          className="p-2 border rounded"
        />
        <Button onClick={() => router.push("/meeting/new")}>New Meeting</Button>
      </div>
      <div className="mt-4">
        {meetings.length === 0 ? (
          <p className="text-gray-500">No meetings recorded for this date.</p>
        ) : (
          <ul>
            {meetings.map((meeting) => (
              <li
                key={meeting.id}
                className="mt-2 p-3 bg-gray-200 rounded cursor-pointer hover:bg-gray-300 transition"
                onClick={() => router.push(`/meeting/${meeting.id}`)}
              >
                <strong>{meeting.name}</strong> -{" "}
                {new Date(meeting.created_at).toLocaleString()}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
