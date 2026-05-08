interface Leader {
  rank: number;
  name: string;
  referral_count: number;
  total_earned: number;
}

const seedEntries: Omit<Leader, 'rank'>[] = [
  { name: 'Joshua S.',    referral_count: 48, total_earned: 240 },
  { name: 'Maria R.',     referral_count: 43, total_earned: 215 },
  { name: 'Carlo M.',     referral_count: 39, total_earned: 195 },
  { name: 'Kristina B.',  referral_count: 35, total_earned: 175 },
  { name: 'Angelo T.',    referral_count: 31, total_earned: 155 },
  { name: 'Grace O.',     referral_count: 29, total_earned: 145 },
  { name: 'Patrick G.',   referral_count: 26, total_earned: 130 },
  { name: 'Lovely D.',    referral_count: 24, total_earned: 120 },
  { name: 'Kevin F.',     referral_count: 21, total_earned: 105 },
  { name: 'Jennifer A.',  referral_count: 19, total_earned: 95  },
  { name: 'Ryan V.',      referral_count: 17, total_earned: 85  },
  { name: 'Diana L.',     referral_count: 15, total_earned: 75  },
  { name: 'Michael C.',   referral_count: 14, total_earned: 70  },
  { name: 'Sheila P.',    referral_count: 12, total_earned: 60  },
  { name: 'Dennis Mo.',   referral_count: 11, total_earned: 55  },
  { name: 'Nora Sa.',     referral_count: 10, total_earned: 50  },
  { name: 'Brian Ag.',    referral_count: 9,  total_earned: 45  },
  { name: 'Rowena Di.',   referral_count: 8,  total_earned: 40  },
  { name: 'Gerald Ra.',   referral_count: 7,  total_earned: 35  },
  { name: 'Maribel Ri.',  referral_count: 6,  total_earned: 30  },
];

export const leaderboardSeedData: Leader[] = seedEntries.map((e, i) => ({
  rank: i + 1,
  ...e,
}));
