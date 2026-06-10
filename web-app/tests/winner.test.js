import assert from "assert";

import {
    createGame,
    selectUnit,
    PLAYER_1,
    PLAYER_2,
    EMPTY
} from "../game-state.js";

import {
    attackCore,
    spawnWeaponDrop
} from "../game-rules.js";

describe("Winner Detection", function () {

    it("winner is EMPTY at the start of the game", function () {

        const game = createGame();
        assert.strictEqual(game.winner, EMPTY, "no winner should exist at game start");
    });

    it("sets winner when a core is destroyed", function () {

        let game = createGame();

        game = {
            ...game,
            units: game.units.map(function (u) {
                return u.owner === PLAYER_1
                    ? { ...u, x: 4, y: 5, inventory: [{ id: 1, type: "zero_day", name: "Zero-Day", damage: 100, range: 2, uses: 1 }] }
                    : u;
            })
        };

        game = selectUnit(1, game);

        const result = attackCore(5, 5, game);
        assert.strictEqual(result.winner, PLAYER_1, "player 1 should be declared winner after destroying p2 core");
    });

    it("does not set winner when core still has hp remaining", function () {

        let game = createGame();

        game = {
            ...game,
            units: game.units.map(function (u) {
                return u.owner === PLAYER_1
                    ? { ...u, x: 4, y: 5 }
                    : u;
            })
        };

        game = selectUnit(1, game);

        const result = attackCore(5, 5, game);
        assert.strictEqual(result.winner, EMPTY, "winner should remain EMPTY when core survives the hit");
    });

    it("core hp is reduced but not zero after one weak hit", function () {

        let game = createGame();

        game = {
            ...game,
            units: game.units.map(function (u) {
                return u.owner === PLAYER_1
                    ? { ...u, x: 4, y: 5 }
                    : u;
            })
        };

        game = selectUnit(1, game);

        const result = attackCore(5, 5, game);
        const p2_core = result.cores.find(function (c) { return c.owner === PLAYER_2; });

        assert.ok(
            p2_core.hp < 20 && p2_core.hp > 0,
            "core hp should be between 0 and 20 after a single ping hit"
        );
    });

    it("core hp cannot go below zero", function () {

        let game = createGame();

        game = {
            ...game,
            units: game.units.map(function (u) {
                return u.owner === PLAYER_1
                    ? { ...u, x: 4, y: 5, inventory: [{ id: 1, type: "zero_day", name: "Zero-Day", damage: 999, range: 2, uses: 1 }] }
                    : u;
            })
        };

        game = selectUnit(1, game);

        const result = attackCore(5, 5, game);
        const p2_core = result.cores.find(function (c) { return c.owner === PLAYER_2; });

        assert.strictEqual(p2_core.hp, 0, "core hp should floor at 0, not go negative");
    });

    it("correct player is recorded as the winner", function () {

        let game = createGame();

        game = {
            ...game,
            units: game.units.map(function (u) {
                return u.owner === PLAYER_1
                    ? { ...u, x: 4, y: 5, inventory: [{ id: 1, type: "zero_day", name: "Zero-Day", damage: 100, range: 2, uses: 1 }] }
                    : u;
            })
        };

        game = selectUnit(1, game);

        const result = attackCore(5, 5, game);
        assert.notStrictEqual(result.winner, PLAYER_2, "p2 should not be recorded as winner when p1 wins");
    });

    it("cannot attack own server", function () {

        let game = createGame();

        game = {
            ...game,
            units: game.units.map(function (u) {
                return u.owner === PLAYER_1
                    ? { ...u, x: 1, y: 0 }
                    : u;
            })
        };

        game = selectUnit(1, game);

        const result = attackCore(0, 0, game);
        assert.strictEqual(result, game, "attacking own server should return unchanged state");
    });

    it("cannot attack from out of range", function () {

        let game = createGame();
        game = selectUnit(1, game);

        const result = attackCore(5, 5, game);
        assert.strictEqual(result, game, "p2 server at (5,5) is out of ping range from (0,1)");
    });

    it("spawnWeaponDrop places a drop of the type determined by the random function", function () {

        // mock_rand always returns 0.5
        // types = ["phishing","malware","zero_day","overclock","emp"]
        // Math.floor(0.5 * 5) = 2 → "zero_day"
        // coordinates: Math.floor(0.5 * 6) = 3 → x=3, y=3
        // clear firewalls so (3,3) is always free
        const mock_rand = function () {
            return 0.5;
        };

        let game = createGame();
        game = { ...game, turn_count: 5, firewalls: [] };

        const result = spawnWeaponDrop(game, mock_rand);

        assert.ok(
            result.weapon_drops.length > 0,
            "a drop should be placed when random_fn is injected"
        );

        assert.strictEqual(
            result.weapon_drops[0].type,
            "zero_day",
            "mock returning 0.5 should select zero_day (index 2 of 5)"
        );
    });

});
