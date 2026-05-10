import { Block, Transaction } from './types';
import { logger } from './logger';
import { calculateHash, hashMatchesDifficulty } from './utils';

export async function mineBlock(
  index: number,
  previousHash: string,
  timestamp: number,
  data: Transaction[],
  difficulty: number
): Promise<Block> {
  let nonce = 0;
  const startTime = Date.now();

  logger.info(`Mining block #${index} (difficulty: ${difficulty})...`);

  return new Promise((resolve) => {
    const tryNonce = () => {
      for (let i = 0; i < 1000; i++) {
        const hash = calculateHash(index, previousHash, timestamp, data, difficulty, nonce);
        if (hashMatchesDifficulty(hash, difficulty)) {
          const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
          logger.info(`Block #${index} mined in ${elapsed}s (nonce: ${nonce})`);
          resolve(new Block(index, hash, previousHash, timestamp, data, difficulty, nonce));
          return;
        }
        nonce++;

        if (nonce % 100000 === 0) {
          const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
          logger.debug(`Mining... nonce: ${nonce}, elapsed: ${elapsed}s`);
        }
      }
      setImmediate(tryNonce);
    };
    setImmediate(tryNonce);
  });
}
