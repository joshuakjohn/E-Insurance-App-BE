import multer, { StorageEngine } from 'multer';

// Disk storage configuration
const storage: StorageEngine = multer.memoryStorage()

// Set up Multer
export const policyProof = multer({
  storage: storage,
}).fields([
  { name: 'policyApplication', maxCount: 1 },
  { name: 'photograph', maxCount: 1 },
  { name: 'idproof', maxCount: 1 },
  { name: 'ageproof', maxCount: 1 },
  { name: 'incomeproof', maxCount: 1 }
]);

export const image = multer({
  storage: storage,
}).fields([
  { name: 'image', maxCount: 1 },
]);
