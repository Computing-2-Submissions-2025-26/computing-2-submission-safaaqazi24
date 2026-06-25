import {
    getDistance,
    selectUnit,
    selectWeapon,
    PLAYER_1,
    PLAYER_2
} from "./game-state.js";

import {
    moveSelectedUnit,
    attackUnit,
    attackCore,
    getReachableTiles,
    hasLineOfSight,
    endTurn
} from "./game-rules.js";

// finds the first weapon in an inventory that can actually land a hit
// on target (in range, and if ranged, not blocked by a firewall)
const findUsableWeapon = function (unit, target, firewalls) {
    return unit.inventory.findIndex(function (w) {
        if (!target || w.damage === 0) {
            return false;
        }
        const dist = getDistance(unit.x, unit.y, target.x, target.y);
        if (dist > w.range) {
            return false;
        }
        if (w.range > 1) {
            return hasLineOfSight(
                unit.x,
                unit.y,
                target.x,
                target.y,
                firewalls
            );
        }
        return true;
    });
};

/**
 * Plays one full turn for player 2 as a simple FSM:
 * attack the agent if possible, else attack the server if possible,
 * else move toward whichever target is closest. No lookahead/minimax –
 * just immediate priorities, same as a basic enemy in any turn-based game.
 * @param {GameState} game
 * @returns {GameState}
 */
const playBotTurn = function (game) {

    const bot = game.units.find(function (u) {
        return u.owner === PLAYER_2;
    });

    if (!bot) {
        return endTurn(game);  // bot's agent is dead/respawning
    }

    let next = selectUnit(bot.id, game);

    const enemy_unit = next.units.find(function (u) {
        return u.owner === PLAYER_1;
    });
    const enemy_core = next.cores.find(function (c) {
        return c.owner === PLAYER_1;
    });

    const unit_weapon_index = findUsableWeapon(
        bot,
        enemy_unit,
        next.firewalls
    );

    if (unit_weapon_index !== -1) {
        next = selectWeapon(unit_weapon_index, next);
        return attackUnit(enemy_unit.x, enemy_unit.y, next);
    }

    const core_weapon_index = findUsableWeapon(
        bot,
        enemy_core,
        next.firewalls
    );

    if (core_weapon_index !== -1) {
        next = selectWeapon(core_weapon_index, next);
        return attackCore(enemy_core.x, enemy_core.y, next);
    }

    // nothing in range yet – close the gap, falling back to the server
    const target = enemy_unit || enemy_core;

    if (!target) {
        return endTurn(next);
    }

    const reachable = getReachableTiles(bot, next);

    if (reachable.length === 0) {
        return endTurn(next);
    }

    const best_tile = reachable.reduce(function (closest, tile) {
        const tile_dist = getDistance(tile.x, tile.y, target.x, target.y);
        const closest_dist = getDistance(
            closest.x,
            closest.y,
            target.x,
            target.y
        );
        return (
            tile_dist < closest_dist
            ? tile
            : closest
        );
    }, reachable[0]);

    const moved = moveSelectedUnit(best_tile.x, best_tile.y, next);

    return (
        moved === next
        ? endTurn(next)
        : moved
    );
};

export {playBotTurn};
