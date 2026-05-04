import type { Knex } from 'knex';

interface TaskSeed {
  title: string;
  description: string;
  category: 'survey' | 'app_install' | 'video' | 'microjob' | 'game';
  payout: number;
  is_active: boolean;
}

export async function seed(knex: Knex): Promise<void> {
  await knex('tasks').del();
  const tasks: TaskSeed[] = [
    { title: 'Complete a 5-minute lifestyle survey', description: 'Answer questions about your daily habits and preferences.', category: 'survey', payout: 45, is_active: true },
    { title: 'Product opinion survey — food & beverages', description: 'Share your feedback on local food brands.', category: 'survey', payout: 80, is_active: true },
    { title: 'Install GCash and complete KYC', description: 'Download the app, verify your identity, and earn.', category: 'app_install', payout: 250, is_active: true },
    { title: 'Install gaming app and reach Level 5', description: 'Play a casual mobile game and hit Level 5 milestone.', category: 'app_install', payout: 150, is_active: true },
    { title: 'Watch a 30-second branded video ad', description: 'Watch a short video to the end and confirm completion.', category: 'video', payout: 10, is_active: true },
    { title: 'Subscribe to a YouTube channel', description: 'Subscribe to a sponsored creator channel.', category: 'video', payout: 15, is_active: true },
    { title: 'Label 20 product images', description: 'Tag and categorize product photos for an AI dataset.', category: 'microjob', payout: 60, is_active: true },
    { title: 'Transcribe a 1-minute Tagalog audio clip', description: 'Type out what you hear in a short Tagalog recording.', category: 'microjob', payout: 100, is_active: true },
    { title: 'Play Kitazon Trivia — reach 1,000 points', description: 'Answer trivia questions and hit the score milestone.', category: 'game', payout: 75, is_active: true },
    { title: "Daily Puzzle — complete today's puzzle", description: 'Solve the daily word puzzle challenge.', category: 'game', payout: 30, is_active: true },
  ];
  await knex('tasks').insert(tasks);
}
