
interface LearningItem {
  original: string;
  corrected: string;
}

export function saveLearning(original: string, corrected: string) {
  if (!original || !corrected || original === corrected) return;
  
  const data: LearningItem[] = JSON.parse(localStorage.getItem('pharmaflow_ocr_learning') || '[]');
  
  // Check if we already have this correction
  const exists = data.some(item => item.original === original && item.corrected === corrected);
  if (exists) return;

  data.push({ original, corrected });
  localStorage.setItem('pharmaflow_ocr_learning', JSON.stringify(data));
}

export function applyLearning(text: string): string {
  const data: LearningItem[] = JSON.parse(localStorage.getItem('pharmaflow_ocr_learning') || '[]');
  
  let result = text;
  data.forEach(item => {
    // Use regex for global replacement to avoid infinite loops if one correction is a substring of another
    try {
      const escapedOriginal = item.original.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      result = result.replace(new RegExp(escapedOriginal, 'g'), item.corrected);
    } catch (e) {
      // Fallback to replaceAll if regex fails
      result = result.split(item.original).join(item.corrected);
    }
  });

  return result;
}
