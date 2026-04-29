export const WORDS = [
  'apple', 'arrow', 'anchor', 'balloon', 'banana', 'bridge', 'butterfly', 'cactus',
  'camera', 'candle', 'castle', 'cloud', 'compass', 'crown', 'diamond', 'dolphin',
  'dragon', 'drum', 'eagle', 'elephant', 'envelope', 'feather', 'fire', 'fish',
  'flag', 'flower', 'fork', 'frog', 'guitar', 'hammer', 'hat', 'heart',
  'helicopter', 'house', 'igloo', 'island', 'jellyfish', 'key', 'kite', 'ladder',
  'lamp', 'leaf', 'lighthouse', 'lion', 'lock', 'moon', 'mountain', 'mushroom',
  'needle', 'net', 'octopus', 'orange', 'owl', 'paintbrush', 'penguin', 'piano',
  'pineapple', 'pizza', 'planet', 'pumpkin', 'rainbow', 'robot', 'rocket', 'rose',
  'sailboat', 'scissors', 'shark', 'shoe', 'snowflake', 'spider', 'star', 'sun',
  'sunflower', 'sword', 'telescope', 'tent', 'tiger', 'torch', 'tornado', 'train',
  'tree', 'trophy', 'turtle', 'umbrella', 'volcano', 'watch', 'waterfall', 'whale',
  'windmill', 'witch', 'wolf', 'wrench', 'zebra', 'zipper', 'crown', 'cave',
  'bucket', 'bridge', 'clock', 'cloud', 'crab', 'crane', 'crystal', 'dagger',
]

export function pickWord() {
  return WORDS[Math.floor(Math.random() * WORDS.length)]
}
