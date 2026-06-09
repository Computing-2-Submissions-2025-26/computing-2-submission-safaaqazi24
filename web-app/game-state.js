/**
 * NET//BREACH – game state module.
 * Pure functions only – nothing in here mutates state directly.
 *
 * @module NET_BREACH
 */

const BOARD_SIZE = 6;
const PLAYER_1 = 1;
const PLAYER_2 = 2;
const EMPTY = 0;
const INVENTORY_LIMIT = 3;
const FIREWALL_COUNT = 4;  // how many wall tiles to scatter on the board
const RESPAWN_DELAY = 3;   // turns until a dead agent comes back

// weapon definitions – damage, range, uses
// ping is the fallback (infinite use, melee only)
// overclock is a movement item – no damage, just lets you sprint up to 4 tiles
const WEAPONS = {
    ping: {
        name: "Ping",
        damage: 1,
        range: 1,
        uses: Infinity
    },
    phishing: {
        name: "Phishing",
        damage: 2,
        range: 1,
        uses: 3
    },
    malware: {
        name: "Malware",
        damage: 3,
        range: 3,
        uses: 2
    },
    zero_day: {
        name: "Zero-Day",
        damage: 5,
        range: 4,
        uses: 1
    },
    overclock: {
        name: "Overclock",
        damage: 0,
        range: 0,
        movement_boost: 4,  // lets the agent move up to 4 tiles, consumed on use
        uses: 1
    }
};

const createWeapon = function (type) {
    return {
        id: Date.now() + Math.random(),
        type: type,
        ...WEAPONS[type]
    };
};

/**
 * Pick random firewall positions at game start.
 * Avoids unit spawn tiles and the corner servers.
 * Keeps a small buffer around each player's starting area.
 */
const generateFirewalls = function (units, cores, board_size) {

    // build a list of tiles we must keep clear
    const off_limits = [];

    units.forEach(function (u) {
        off_limits.push({ x: u.x, y: u.y });
    });

    cores.forEach(function (c) {
        off_limits.push({ x: c.x, y: c.y });
    });

    // buffer tiles around each spawn so the game isn't immediately blocked
    const buffer = [
        { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 2 },
        { x: 4, y: 5 }, { x: 4, y: 4 }, { x: 5, y: 3 }
    ];

    buffer.forEach(function (b) {
        off_limits.push(b);
    });

    const walls = [];
    let tries = 0;

    while (walls.length < FIREWALL_COUNT && tries < 200) {

        tries += 1;

        const x = Math.floor(Math.random() * board_size);
        const y = Math.floor(Math.random() * board_size);

        const taken = off_limits.some(function (t) {
            return t.x === x && t.y === y;
        });

        const already = walls.some(function (w) {
            return w.x === x && w.y === y;
        });

        if (!taken && !already) {
            walls.push({ x: x, y: y });
        }
    }

    return walls;
};

/**
 * Build the initial game state object.
 * @returns {object} Fresh game state.
 */
const createGame = function () {

    const cores = [
        { owner: PLAYER_1, x: 0, y: 0, hp: 20 },
        { owner: PLAYER_2, x: 5, y: 5, hp: 20 }
    ];

    const units = [
        {
            id: 1,
            owner: PLAYER_1,
            class_name: "Agent",
            x: 0,
            y: 1,
            hp: 5,
            max_hp: 5,
            movement: 1,
            status: null,       // "slowed" | null – set by malware hits
            inventory: [createWeapon("ping")]
        },
        {
            id: 2,
            owner: PLAYER_2,
            class_name: "Agent",
            x: 5,
            y: 4,
            hp: 5,
            max_hp: 5,
            movement: 1,
            status: null,
            inventory: [createWeapon("ping")]
        }
    ];

    return {
        current_player: PLAYER_1,
        winner: EMPTY,
        selected_unit_id: null,
        selected_weapon_index: 0,
        turn_count: 0,
        board_size: BOARD_SIZE,
        cores: cores,
        units: units,
        weapon_drops: [],
        firewalls: generateFirewalls(units, cores, BOARD_SIZE),
        // each entry: { owner, turns_left, next_id }
        respawn_queue: []
    };
};

/**
 * Manhattan distance between two tiles.
 * @param {number} x1
 * @param {number} y1
 * @param {number} x2
 * @param {number} y2
 * @returns {number}
 */
const getDistance = function (x1, y1, x2, y2) {
    return Math.abs(x1 - x2) + Math.abs(y1 - y2);
};

/**
 * Returns the unit at (x, y), or undefined if the tile is empty.
 * @param {number} x
 * @param {number} y
 * @param {GameState} game
 * @returns {Unit|undefined}
 */
const getUnitAtPosition = function (x, y, game) {
    return game.units.find(function (u) {
        return u.x === x && u.y === y;
    });
};

/**
 * Returns the core (server) at (x, y), or undefined.
 * @param {number} x
 * @param {number} y
 * @param {GameState} game
 * @returns {Core|undefined}
 */
const getCoreAtPosition = function (x, y, game) {
    return game.cores.find(function (c) {
        return c.x === x && c.y === y;
    });
};

/**
 * Returns the weapon drop (data-cache) at (x, y), or undefined.
 * @param {number} x
 * @param {number} y
 * @param {GameState} game
 * @returns {object|undefined}
 */
const getWeaponAtPosition = function (x, y, game) {
    return game.weapon_drops.find(function (d) {
        return d.x === x && d.y === y;
    });
};

/**
 * Returns the firewall tile at (x, y), or undefined.
 * @param {number} x
 * @param {number} y
 * @param {GameState} game
 * @returns {object|undefined}
 */
const getFirewallAtPosition = function (x, y, game) {
    return game.firewalls.find(function (f) {
        return f.x === x && f.y === y;
    });
};

/**
 * Select or deselect a unit. Clicking the same unit twice deselects it.
 * @param {number} unit_id
 * @param {GameState} game
 * @returns {GameState}
 */
const selectUnit = function (unit_id, game) {
    return {
        ...game,
        selected_unit_id:
            game.selected_unit_id === unit_id
            ? null
            : unit_id
    };
};

/**
 * Set the active weapon slot index for the current player.
 * @param {number} index
 * @param {GameState} game
 * @returns {GameState}
 */
const selectWeapon = function (index, game) {
    return { ...game, selected_weapon_index: index };
};

/**
 * Add a weapon to a unit's inventory.
 * Drops the oldest item if already at the limit (FIFO).
 */
const addWeaponToInventory = function (unit, weapon_type) {

    const inventory = [...unit.inventory, createWeapon(weapon_type)];

    if (inventory.length > INVENTORY_LIMIT) {
        inventory.shift();  // drop oldest – FIFO
    }

    return { ...unit, inventory: inventory };
};

export {
    BOARD_SIZE,
    PLAYER_1,
    PLAYER_2,
    EMPTY,
    INVENTORY_LIMIT,
    WEAPONS,
    RESPAWN_DELAY,
    createWeapon,
    createGame,
    getDistance,
    getUnitAtPosition,
    getCoreAtPosition,
    getWeaponAtPosition,
    getFirewallAtPosition,
    selectUnit,
    selectWeapon,
    addWeaponToInventory
};