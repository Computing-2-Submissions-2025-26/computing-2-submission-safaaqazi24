import assert from "assert";

import {
    createGame,
    selectUnit,
    PLAYER_1,
    PLAYER_2
} from "../game-state.js";

import {
    attackUnit,
    moveSelectedUnit
} from "../game-rules.js";

describe("Combat", function () {

    it("phishing removes the stolen weapon from the enemy's inventory", function () {

        let game = createGame();

        game = {
            ...game,
            firewalls: [],
            units: game.units.map(function (u) {
                if (u.owner === PLAYER_1) {
                    return {
                        ...u,
                        x: 1, y: 1,
                        inventory: [{ id: 1, type: "phishing", name: "Phishing", damage: 2, range: 1, uses: Infinity }]
                    };
                }
                return {
                    ...u,
                    x: 1, y: 2,
                    inventory: [{ id: 2, type: "malware", name: "Malware", damage: 3, range: 1, uses: 1 }]
                };
            }),
            selected_weapon_index: 0
        };

        game = selectUnit(1, game);

        const result = attackUnit(1, 2, game);
        const target = result.units.find(function (u) { return u.owner === PLAYER_2; });
        const attacker = result.units.find(function (u) { return u.owner === PLAYER_1; });

        const target_still_has_it = target.inventory.some(function (w) { return w.type === "malware"; });
        const attacker_got_it = attacker.inventory.some(function (w) { return w.type === "malware"; });

        assert.strictEqual(target_still_has_it, false, "phishing should steal the weapon, not just copy it");
        assert.ok(attacker_got_it, "attacker should receive the stolen weapon");
    });

    it("turn skips a player with no living units instead of softlocking", function () {

        let game = createGame();

        // kill player 2's agent directly so it's their turn with zero units
        game = {
            ...game,
            firewalls: [],
            units: game.units.map(function (u) {
                if (u.owner === PLAYER_1) {
                    return {
                        ...u,
                        x: 1, y: 1,
                        inventory: [{ id: 1, type: "zero_day", name: "Zero-Day", damage: 100, range: 4, uses: 1 }]
                    };
                }
                return { ...u, x: 1, y: 2 };
            }),
            selected_weapon_index: 0
        };

        game = selectUnit(1, game);

        const after_kill = attackUnit(1, 2, game);

        // player 2 has no units now, but their turn must not stall –
        // it should auto-advance back to player 1 instead of hanging on a dead player
        const p2_has_unit = after_kill.units.some(function (u) { return u.owner === PLAYER_2; });

        assert.strictEqual(p2_has_unit, false, "player 2's agent should be dead and off the board");
        assert.strictEqual(
            after_kill.current_player,
            PLAYER_1,
            "turn should skip the dead player and return to player 1 rather than softlocking"
        );
    });

});
