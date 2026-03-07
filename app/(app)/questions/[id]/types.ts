export type NegotiationStatus = "PENDING" | "ACCEPTED" | "REJECTED";

export type AnswerUser = {
  id: string;
  name: string | null;
  email: string;
};

export type AnswerImage = {
  id: string;
  url: string;
  sortOrder: number;
  createdAt: Date | string;
};

export type AnswerRead = {
  id: string;
  userId: string;
  answerId: string;
  readAt: Date | string;
};

export type AnswerComment = {
  id: string;
  content: string;
  createdAt: Date | string;
  user: AnswerUser | null;
};

export type AnswerNegotiation = {
  id: string;
  proposedAmount: number;
  status: NegotiationStatus;
} | null;

export type QuestionAnswer = {
  id: string;
  content: string | null;
  createdAt: Date | string;
  questionId: string;
  userId: string | null;
  likeCount: number;
  pitch: string | null;
  user: AnswerUser | null;
  images: AnswerImage[];
  reads: AnswerRead[];
  comments: AnswerComment[] | null;
  negotiation: AnswerNegotiation;
  locked: boolean;
};
