/**
 * ReelX Recommendation Engine Configuration
 * 
 * This file centralizes the scoring weights for the personalized feed algorithm.
 * The system ranks candidate videos based on these multipliers, combining 
 * global engagement with individual user affinity.
 */

export const RecommendationConfig = {
  // Global Engagement Signals (Base Score)
  globalWeights: {
    like: 2,           // Points per like
    comment: 3,        // Points per comment
    share: 5,          // Points per share (hypothetical)
  },

  // Personalization Signals (Affinity Score)
  affinityMultipliers: {
    // When a user watches >80% of a video, they gain affinity with the creator
    creatorAffinityBonus: 5,
    
    // When a user loops/rewatches a specific video >2 times, that exact video gets a massive boost
    exactVideoLoopBonus: 10,
    
    // Minimum threshold of watched seconds to trigger an affinity calculation
    minWatchSecondsThreshold: 2,
    
    // The percentage of the video duration that must be watched to trigger creator affinity (e.g. 0.8 = 80%)
    completionRateThreshold: 0.8,
  },

  // Diversity & Penalty Rules
  diversity: {
    // Prevent the feed from being dominated by one creator
    maxConsecutiveCreatorVideos: 2,
    
    // Score penalty for recently seen videos (to prevent infinite loops of same content)
    recentlySeenPenalty: -50,
  },

  // Cold Start / Exploration
  exploration: {
    // Percentage of the feed that should be purely random/fresh content to break echo chambers
    explorationRatio: 0.15, // 15%
  }
};