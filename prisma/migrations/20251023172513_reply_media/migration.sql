-- CreateTable
CREATE TABLE "ReplyMedia" (
    "replyId" TEXT NOT NULL,
    "mediaId" TEXT NOT NULL,

    CONSTRAINT "ReplyMedia_pkey" PRIMARY KEY ("replyId","mediaId")
);

-- AddForeignKey
ALTER TABLE "ReplyMedia" ADD CONSTRAINT "ReplyMedia_replyId_fkey" FOREIGN KEY ("replyId") REFERENCES "Reply"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReplyMedia" ADD CONSTRAINT "ReplyMedia_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "Media"("id") ON DELETE CASCADE ON UPDATE CASCADE;
