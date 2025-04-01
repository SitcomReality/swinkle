/**
 * level-generator.js
 * Procedurally generates game levels with obstacles following specified configuration.
 */

import config from '../config.js';
import { levelCollider } from './collision.js';

const levelGenConfig = {
    gameArea: { width: config.gameAreaWid, height: config.gameAreaHeiHght },
    symmetry: true,
    oCount: { min: 4, max: 8 },
};
const obstacleSizeWidth = { min: 30, max: 400 };
const obstacleSizeHeight = { min: 20, max: 60 };

export function generateLevel() {
   const level = {
       id: `level-${Math.floor(Math.random() * 1000)}`,
       name: generateName(),
       obstacles: []
    };
       
   // Generate obstacles using levelGenConfig
   level.obstacles = []; // initialize obstacles array
   
   return level;
}

export default levelGenConfig;

// Removed getLevel() since we're using the dynamically created ones