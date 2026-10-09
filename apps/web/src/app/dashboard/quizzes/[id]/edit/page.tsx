'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { QuizEditor } from '@/components/QuizEditor';
import { apiRequest } from '@/lib/api';

export default function EditQuizPage() {
  const params = useParams();
  const id = params?.id as string;
  const [quizData, setQuizData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      apiRequest(`/quizzes/${id}`)
        .then((data) => setQuizData(data))
        .catch((e) => console.error(e))
        .finally(() => setLoading(false));
    }
  }, [id]);

  if (loading) {
    return <div className="p-12 text-center text-sm text-gray-500">Yuklanmoqda...</div>;
  }

  if (!quizData) {
    return <div className="p-12 text-center text-sm text-red-500">Test topilmadi</div>;
  }

  return <QuizEditor initialData={quizData} />;
}
