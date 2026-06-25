/**
 * @file NET//BREACH game module.
 * @module NET_BREACH
 *
 * @description
 * Pure-functional state machine for a two-player cyber-warfare tactics game
 * played on a 6x6 network grid.
 *
 * Each player controls one Agent. Goal: reduce the enemy Server to 0 HP.
 * All functions return new state objects – nothing is mutated in place.
 *
 *   - Firewall tiles block both movement and ranged line-of-sight
 *   - Agents can attack each other directly (unit vs unit)
 *   - Malware applies a "slowed" status effect for one turn
 *   - Phishing steals the target's first non-ping weapon
 *   - Dead agents are queued for respawn after RESPAWN_DELAY turns
 *   - Bresenham LOS check for any weapon with range > 1
 */

export { createGame } from "./game-state.js";
export {
    moveSelectedUnit,
    attackCore,
    attackUnit,
    spawnWeaponDrop,
    hasLineOfSight
} from "./game-rules.js";

/**
 * @typedef {object} Weapon
 * @property {number} id        - Unique ID (Date.now + random)
 * @property {string} type      - "ping" | "phishing" | "malware" | "zero_day"
 * @property {string} name      - Display name
 * @property {number} damage    - HP removed per hit
 * @property {number} range     - Maximum Manhattan distance for attack
 * @property {number|Infinity} uses - Remaining uses; Infinity for ping
 */

/**
 * @typedef {object} Unit
 * @property {number}   id         - Unique unit ID
 * @property {number}   owner      - PLAYER_1 | PLAYER_2
 * @property {string}   class_name - Always "Agent" for now
 * @property {number}   x          - Column (0–5)
 * @property {number}   y          - Row (0–5)
 * @property {number}   hp         - Current hit points
 * @property {number}   max_hp     - Max hit points (5)
 * @property {number}   movement   - Tiles per turn (1)
 * @property {string|null} status  - "slowed" | null
 * @property {Weapon[]} inventory  - Up to INVENTORY_LIMIT weapons (FIFO)
 */

/**
 * @typedef {object} Core
 * @property {number} owner - PLAYER_1 | PLAYER_2
 * @property {number} x
 * @property {number} y
 * @property {number} hp   - Current HP (starts at 20)
 */

/**
 * @typedef {object} RespawnEntry
 * @property {number} owner       - Which player's agent is respawning
 * @property {number} turns_left  - Turns until spawn
 * @property {number} next_id     - ID the new agent will get
 */

/**
 * @typedef {object} GameState
 * @property {number}          current_player       - Whose turn it is
 * @property {number}          winner               - EMPTY|PLAYER_1|PLAYER_2
 * @property {number|null}     selected_unit_id     - currently selected unit
 * @property {number}          selected_weapon_index
 * @property {number}          turn_count
 * @property {number}          board_size           - 6
 * @property {Core[]}          cores
 * @property {Unit[]}          units
 * @property {object[]}        weapon_drops         - Data-caches on the board
 * @property {object[]}        firewalls            - Impassable tiles {x,y}
 * @property {RespawnEntry[]}  respawn_queue
 */

/**
 * Create a fresh game state with randomised firewall positions.
 * @returns {GameState}
 */

/**
 * Move the selected agent to (x, y).
 * Fails silently (returns same state) if the move is illegal.
 * Slowed agents cannot move.
 * @param {number}    x
 * @param {number}    y
 * @param {GameState} game
 * @returns {GameState}
 */

/**
 * Fire an exploit at the enemy server at (x, y).
 * Ranged weapons require an unobstructed Bresenham line of sight.
 * @param {number}    x
 * @param {number}    y
 * @param {GameState} game
 * @returns {GameState}
 */

/**
 * Attack the enemy agent standing at (x, y).
 * Malware slows the target for one turn.
 * Phishing copies the target's first non-ping weapon.
 * A killed agent enters the respawn queue.
 * @param {number}    x
 * @param {number}    y
 * @param {GameState} game
 * @returns {GameState}
 */

/**
 * Check whether there is an unobstructed straight line from
 * (x1,y1) to (x2,y2), treating firewalls as opaque blockers.
 * Uses Bresenham's line algorithm.
 * @param {number}   x1
 * @param {number}   y1
 * @param {number}   x2
 * @param {number}   y2
 * @param {object[]} firewalls
 * @returns {boolean}
 */

/**
 * Attempt to place a random data-cache on the board.
 * Only runs on turns divisible by 3; skips if no free tile is found.
 * @param {GameState} game
 * @returns {GameState}
 */