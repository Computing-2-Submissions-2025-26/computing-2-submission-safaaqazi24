import {
    PLAYER_1,
    PLAYER_2,
    EMPTY,
    WEAPONS,
    RESPAWN_DELAY,
    getDistance,
    getUnitAtPosition,
    getCoreAtPosition,
    getWeaponAtPosition,
    getFirewallAtPosition,
    addWeaponToInventory
} from "./game-state.js";

/**
 * Check a tile is within the board boundaries.
 * @param {number} x
 * @param {number} y
 * @param {number} board_size
 * @returns {boolean}
 */
const inBounds = function (x, y, board_size) {
    return x >= 0 && x < board_size && y >= 0 && y < board_size;
};

/**
 * Bresenham line-of-sight check.
 * Ranged weapons (range > 1) use this to see if a firewall blocks the shot.
 * https://en.wikipedia.org/wiki/Bresenham%27s_line_algorithm
 * @param {number}   x1
 * @param {number}   y1
 * @param {number}   x2
 * @param {number}   y2
 * @param {object[]} firewalls
 * @returns {boolean}
 */
const hasLineOfSight = function (x1, y1, x2, y2, firewalls) {

    let dx = Math.abs(x2 - x1);
    let dy = Math.abs(y2 - y1);
    let sx = x1 < x2 ? 1 : -1;
    let sy = y1 < y2 ? 1 : -1;
    let err = dx - dy;
    let cx = x1;
    let cy = y1;

    // bounded by manhattan distance – guarantees termination, no infinite loop
    const max_steps = dx + dy + 1;
    let step = 0;

    while (step < max_steps) {

        step += 1;

        if (cx === x2 && cy === y2) {
            return true;  // reached target – path is clear
        }

        // skip the starting tile – standing next to a wall shouldnt block you
        if (!(cx === x1 && cy === y1)) {
            const wall = firewalls.some(function (fw) {
                return fw.x === cx && fw.y === cy;
            });
            if (wall) {
                return false;  // blocked by a firewall
            }
        }

        const e2 = 2 * err;

        if (e2 > -dy) {
            err -= dy;
            cx += sx;
        }

        if (e2 < dx) {
            err += dx;
            cy += sy;
        }
    }

    return false;
};

// clears "slowed" status for the player whose turn is ending only
// so malware persists through the enemy turn before wearing off
const clearStatusEffects = function (game) {
    const updated_units = game.units.map(function (u) {
        if (u.status === null) {
            return u;
        }
        if (u.owner !== game.current_player) {
            return u;  // dont clear debuffs on the other player's units yet
        }
        return { ...u, status: null };
    });
    return { ...game, units: updated_units };
};

/**
 * Tick the respawn queue down by one.
 * Any entry reaching zero gets a fresh agent placed at their home spawn tile.
 * @param {GameState} game
 * @returns {GameState}
 */
const processRespawnQueue = function (game) {

    if (game.respawn_queue.length === 0) {
        return game;
    }

    let live_units = [...game.units];
    const still_waiting = [];

    game.respawn_queue.forEach(function (entry) {

        if (entry.turns_left > 1) {
            still_waiting.push({ ...entry, turns_left: entry.turns_left - 1 });
            return;
        }

        const spawn_x = entry.owner === PLAYER_1 ? 0 : 5;
        const spawn_y = entry.owner === PLAYER_1 ? 1 : 4;

        const occupied = live_units.some(function (u) {
            return u.x === spawn_x && u.y === spawn_y;
        });

        if (occupied) {
            still_waiting.push({ ...entry, turns_left: 1 });
            return;
        }

        live_units.push({
            id: entry.next_id,
            owner: entry.owner,
            class_name: "Agent",
            x: spawn_x,
            y: spawn_y,
            hp: 5,
            max_hp: 5,
            movement: 1,
            status: null,
            inventory: [{ type: "ping", ...WEAPONS.ping, id: Date.now() + Math.random() }]
        });
    });

    return { ...game, units: live_units, respawn_queue: still_waiting };
};

/**
 * End the current turn, clear status effects, process respawns,
 * and pass control to the other player.
 * @param {GameState} game
 * @returns {GameState}
 */
const endTurn = function (game) {

    let next = clearStatusEffects(game);
    next = processRespawnQueue(next);

    return {
        ...next,
        current_player: next.current_player === PLAYER_1 ? PLAYER_2 : PLAYER_1,
        selected_unit_id: null,
        selected_weapon_index: 0,
        turn_count: next.turn_count + 1
    };
};

// reduce a weapons uses by one and remove it if depleted
// always ensures at least a ping remains in inventory
const useWeapon = function (unit, weapon_index) {

    const inventory = unit.inventory
        .map(function (item, i) {
            if (i !== weapon_index) {
                return item;
            }
            if (item.uses === Infinity) {
                return item;
            }
            return { ...item, uses: item.uses - 1 };
        })
        .filter(function (item) {
            return item.uses > 0 || item.uses === Infinity;
        });

    return {
        ...unit,
        inventory: inventory.length > 0
            ? inventory
            : [{ type: "ping", ...WEAPONS.ping, id: Date.now() + Math.random() }]
    };
};

/**
 * Move the selected agent one tile (or more with Overclock active).
 * Slowed agents cannot move. Firewalls block movement.
 * Walking over a data-cache picks it up automatically.
 * @param {number}    x
 * @param {number}    y
 * @param {GameState} game
 * @returns {GameState}
 */
const moveSelectedUnit = function (x, y, game) {

    if (game.selected_unit_id === null) {
        return game;
    }

    const unit = game.units.find(function (u) {
        return u.id === game.selected_unit_id;
    });

    if (!unit) {
        return game;
    }

    if (unit.owner !== game.current_player) {
        return game;
    }

    // malware hit last turn – agent is slowed, skip movement
    if (unit.status === "slowed") {
        return game;
    }

    if (!inBounds(x, y, game.board_size)) {
        return game;
    }

    if (getUnitAtPosition(x, y, game)) {
        return game;
    }

    if (getCoreAtPosition(x, y, game)) {
        return game;
    }

    if (getFirewallAtPosition(x, y, game)) {
        return game;
    }

    const distance = getDistance(unit.x, unit.y, x, y);

    // check if overclock item is active – gives a temporary movement boost
    const active_item = unit.inventory[game.selected_weapon_index];
    const overclock_active = (
        active_item &&
        active_item.movement_boost &&
        active_item.movement_boost > unit.movement
    );
    const effective_movement = overclock_active
        ? active_item.movement_boost
        : unit.movement;

    if (distance > effective_movement) {
        return game;
    }

    let updated_units = game.units.map(function (u) {
        return u.id === unit.id ? { ...u, x: x, y: y } : u;
    });

    // consume the overclock if it was used for extra distance
    if (overclock_active && distance > unit.movement) {
        updated_units = updated_units.map(function (u) {
            return u.id === unit.id ? useWeapon(u, game.selected_weapon_index) : u;
        });
    }

    let updated_drops = game.weapon_drops;
    const drop = getWeaponAtPosition(x, y, game);

    if (drop) {
        updated_units = updated_units.map(function (u) {
            return u.id === unit.id ? addWeaponToInventory(u, drop.type) : u;
        });
        updated_drops = game.weapon_drops.filter(function (d) {
            return d.id !== drop.id;
        });
    }

    return endTurn({ ...game, units: updated_units, weapon_drops: updated_drops });
};

/**
 * Fire an exploit at the enemy server.
 * Ranged weapons require a clear Bresenham line of sight through firewalls.
 * @param {number}    x
 * @param {number}    y
 * @param {GameState} game
 * @returns {GameState}
 */
const attackCore = function (x, y, game) {

    if (game.selected_unit_id === null) {
        return game;
    }

    const unit = game.units.find(function (u) {
        return u.id === game.selected_unit_id;
    });

    if (!unit) {
        return game;
    }

    const core = getCoreAtPosition(x, y, game);

    if (!core) {
        return game;
    }

    if (core.owner === unit.owner) {
        return game;
    }

    const weapon = unit.inventory[game.selected_weapon_index];

    if (!weapon || weapon.damage === 0) {
        return game;  // overclock can't attack
    }

    const distance = getDistance(unit.x, unit.y, x, y);

    if (distance > weapon.range) {
        return game;
    }

    if (weapon.range > 1) {
        if (!hasLineOfSight(unit.x, unit.y, x, y, game.firewalls)) {
            return game;
        }
    }

    const updated_cores = game.cores.map(function (c) {
        if (c.x !== x || c.y !== y) {
            return c;
        }
        return { ...c, hp: Math.max(0, c.hp - weapon.damage) };
    });

    const destroyed = updated_cores.find(function (c) { return c.hp <= 0; });

    const updated_units = game.units.map(function (u) {
        return u.id === unit.id ? useWeapon(u, game.selected_weapon_index) : u;
    });

    return endTurn({
        ...game,
        cores: updated_cores,
        units: updated_units,
        winner: destroyed ? unit.owner : EMPTY
    });
};

/**
 * Attack an enemy agent directly.
 * malware  – applies "slowed" status for one turn.
 * phishing – copies the target's first non-ping weapon.
 * A killed agent is removed from the board and queued to respawn.
 * @param {number}    x
 * @param {number}    y
 * @param {GameState} game
 * @returns {GameState}
 */
const attackUnit = function (x, y, game) {

    if (game.selected_unit_id === null) {
        return game;
    }

    const attacker = game.units.find(function (u) {
        return u.id === game.selected_unit_id;
    });

    if (!attacker) {
        return game;
    }

    const target = getUnitAtPosition(x, y, game);

    if (!target) {
        return game;
    }

    if (target.owner === attacker.owner) {
        return game;
    }

    const weapon = attacker.inventory[game.selected_weapon_index];

    if (!weapon || weapon.damage === 0) {
        return game;  // overclock can't attack
    }

    const distance = getDistance(attacker.x, attacker.y, x, y);

    if (distance > weapon.range) {
        return game;
    }

    if (weapon.range > 1) {
        if (!hasLineOfSight(attacker.x, attacker.y, x, y, game.firewalls)) {
            return game;
        }
    }

    const new_hp = Math.max(0, target.hp - weapon.damage);

    let new_target_status = target.status;
    let updated_attacker = useWeapon(attacker, game.selected_weapon_index);

    if (weapon.type === "malware") {
        new_target_status = "slowed";
    }

    if (weapon.type === "phishing") {
        const stealable = target.inventory.find(function (w) {
            return w.type !== "ping";
        });
        if (stealable) {
            updated_attacker = addWeaponToInventory(updated_attacker, stealable.type);
        }
    }

    let updated_units;
    let updated_queue = [...game.respawn_queue];

    if (new_hp <= 0) {

        updated_units = game.units
            .filter(function (u) { return u.id !== target.id; })
            .map(function (u) {
                return u.id === attacker.id ? updated_attacker : u;
            });

        updated_queue.push({
            owner: target.owner,
            turns_left: RESPAWN_DELAY,
            next_id: target.id
        });

    } else {

        updated_units = game.units.map(function (u) {
            if (u.id === target.id) {
                return { ...u, hp: new_hp, status: new_target_status };
            }
            if (u.id === attacker.id) {
                return updated_attacker;
            }
            return u;
        });
    }

    return endTurn({ ...game, units: updated_units, respawn_queue: updated_queue });
};

/**
 * Randomly place a data-cache on the grid.
 * Fires every 5 turns. Skips if no free tile is found after 60 attempts.
 * @param {GameState} game
 * @returns {GameState}
 */
const spawnWeaponDrop = function (game) {

    if (game.turn_count % 5 !== 0) {
        return game;
    }

    const types = ["phishing", "malware", "zero_day", "overclock"];
    const type = types[Math.floor(Math.random() * types.length)];

    let x;
    let y;
    let tries = 0;

    do {
        x = Math.floor(Math.random() * game.board_size);
        y = Math.floor(Math.random() * game.board_size);
        tries += 1;
        if (tries > 60) {
            return game;
        }
    } while (
        getUnitAtPosition(x, y, game) ||
        getCoreAtPosition(x, y, game) ||
        getWeaponAtPosition(x, y, game) ||
        game.firewalls.some(function (f) { return f.x === x && f.y === y; })
    );

    return {
        ...game,
        weapon_drops: [
            ...game.weapon_drops,
            { id: Date.now() + Math.random(), type: type, x: x, y: y }
        ]
    };
};

export { inBounds, hasLineOfSight, endTurn, moveSelectedUnit, attackCore, attackUnit, spawnWeaponDrop };