import React from 'react';
import { useTui } from '../store.js';
import { ReviewSetup } from './ReviewSetup.js';
import { ReviewProgress } from './ReviewProgress.js';
import { ReviewResults } from './ReviewResults.js';

export function ReviewView(): React.ReactElement {
  const [state] = useTui();

  switch (state.reviewPhase) {
    case 'progress':
      return <ReviewProgress />;
    case 'results':
      return <ReviewResults />;
    default:
      return <ReviewSetup />;
  }
}
