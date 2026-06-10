import assert from "assert";

import {
    createGame,
    selectUnit,
    PLAYER_1,
    PLAYER_2
} from "../game-state.js";

import {
    moveSelectedUnit
} from "../game-rules.js";

describe("Movement", function () {

    it("moves one tile", function () {

        let game = createGame();
        game = selectUnit(1, game);

        const moved = moveSelectedUnit(1, 1, game);

        assert.notStrictEqual(moved, game, "a valid one-tile move should return a new state");
    });

    it("cannot move two tiles", function () {

        let game = createGame();
        game = selectUnit(1, game);

        const moved = moveSelectedUnit(2, 1, game);

        assert.strictEqual(moved, game, "moving two tiles should be rejected – movement is 1");
    });

    it("cannot move without selecting a unit first", function () {

        const game = createGame();
        const moved = moveSelectedUnit(1, 1, game);

        assert.strictEqual(moved, game, "no unit is selected so the move should be a no-op");
    });

    it("cannot move to a tile occupied by another unit", function () {

        let game = createGame();

        game = {
            ...game,
            units: game.units.map(function (u) {
                return u.owner === PLAYER_2
                    ? { ...u, x: 1, y: 1 }
                    : u;
            })
        };

        game = selectUnit(1, game);

        const moved = moveSelectedUnit(1, 1, game);
        assert.strictEqual(moved, game, "destination is occupied so the move should be rejected");
    });

    it("cannot move onto a core tile", function () {

        let game = createGame();
        game = selectUnit(1, game);

        const moved = moveSelectedUnit(0, 0, game);
        assert.strictEqual(moved, game, "core tile at (0,0) should block movement");
    });

    it("cannot move out of bounds", function () {

        let game = createGame();
        game = selectUnit(1, game);

        const moved = moveSelectedUnit(-1, 1, game);
        assert.strictEqual(moved, game, "negative coordinates are out of bounds");
    });

    it("ends the turn after a successful move", function () {

        let game = createGame();
        game = selectUnit(1, game);

        const moved = moveSelectedUnit(1, 1, game);

        assert.strictEqual(
            moved.current_player,
            PLAYER_2,
            "turn should pass to player 2 after player 1 moves"
        );
    });

    it("picks up a weapon drop when moving onto it", function () {

        let game = createGame();

        game = {
            ...game,
            weapon_drops: [{ id: 42, type: "phishing", x: 1, y: 1 }]
        };

        game = selectUnit(1, game);

        const moved = moveSelectedUnit(1, 1, game);

        const p1 = moved.units.find(function (u) { return u.owner === PLAYER_1; });
        const picked_up = p1.inventory.some(function (w) { return w.type === "phishing"; });

        assert.ok(picked_up, "phishing drop should appear in agent inventory after stepping on it");
    });

    it("weapon drop is removed from the board after being picked up", function () {

        let game = createGame();

        game = {
            ...game,
            weapon_drops: [{ id: 42, type: "phishing", x: 1, y: 1 }]
        };

        game = selectUnit(1, game);

        const moved = moveSelectedUnit(1, 1, game);
        assert.strictEqual(moved.weapon_drops.length, 0, "drop should be removed from the board after pickup");
    });

    it("slowed agent cannot move", function () {

        let game = createGame();

        game = {
            ...game,
            units: game.units.map(function (u) {
                return u.owner === PLAYER_1
                    ? { ...u, status: "slowed" }
                    : u;
            })
        };

        game = selectUnit(1, game);

        const moved = moveSelectedUnit(1, 1, game);
        assert.strictEqual(moved, game, "slowed status should prevent movement entirely");
    });

    it("agent cannot move onto a firewall tile", function () {

        let game = createGame();

        game = { ...game, firewalls: [{ x: 1, y: 1 }] };
        game = selectUnit(1, game);

        const moved = moveSelectedUnit(1, 1, game);
        assert.strictEqual(moved, game, "firewall at (1,1) should block the move");
    });

    it("overclock lets the agent move more than one tile", function () {

        let game = createGame();

        game = {
            ...game,
            firewalls: [],  // clear random firewalls so the path is always open
            units: game.units.map(function (u) {
                return u.owner === PLAYER_1
                    ? {
                        ...u,
                        x: 1, y: 1,
                        inventory: [{ id: 10, type: "overclock", name: "Overclock", damage: 0, range: 0, movement_boost: 4, uses: 1 }]
                    }
                    : u;
            }),
            selected_weapon_index: 0
        };

        game = selectUnit(1, game);

        const moved = moveSelectedUnit(4, 1, game);
        assert.notStrictEqual(moved, game, "overclock should allow a 3-tile move");
    });

    it("agent cannot move through a firewall to reach a tile behind it", function () {

        let game = createGame();

        // firewall at (2,1) means reaching (4,1) requires a 5-step detour
        // which exceeds the overclock movement boost of 4 – so the move is rejected
        game = {
            ...game,
            firewalls: [{ x: 2, y: 1 }],
            units: game.units.map(function (u) {
                return u.owner === PLAYER_1
                    ? {
                        ...u,
                        x: 1, y: 1,
                        inventory: [{ id: 11, type: "overclock", name: "Overclock", damage: 0, range: 0, movement_boost: 4, uses: 1 }]
                    }
                    : u;
            }),
            selected_weapon_index: 0
        };

        game = selectUnit(1, game);

        const moved = moveSelectedUnit(4, 1, game);
        assert.strictEqual(moved, game, "firewall at (2,1) forces a 5-step detour to (4,1), exceeding overclock range of 4");
    });

});