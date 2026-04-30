export type SerializedLead = {
  id: string;
  name: string | null;
  email: string | null;
  intent: string | null;
  summary: string | null;
  createdAt: string;
};

export type SerializedMeeting = {
  id: string;
  title: string;
  startAt: string;
  endAt: string;
  attendeeName: string | null;
  attendeeEmail: string | null;
  notes: string | null;
  meetingType: string | null;
  locationDetail: string | null;
  bookedByAgent: boolean;
  createdAt: string;
};

export type SerializedKnowledge = {
  id: string;
  title: string;
  content: string;
  sourceType: string;
  filePath: string | null;
  imageCount: number;
  createdAt: string;
};
