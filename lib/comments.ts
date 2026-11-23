export const commentLimits = { name: 60, body: 2000 } as const;

export type ChapterComment = {
  id: number;
  name: string;
  body: string;
  created_at: string;
};

export type CommentPage = { comments: ChapterComment[]; next: number | null };
