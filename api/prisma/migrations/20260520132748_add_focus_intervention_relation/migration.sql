-- AddForeignKey
ALTER TABLE "FocusIntervention" ADD CONSTRAINT "FocusIntervention_deepWorkId_fkey" FOREIGN KEY ("deepWorkId") REFERENCES "DeepWorkSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
