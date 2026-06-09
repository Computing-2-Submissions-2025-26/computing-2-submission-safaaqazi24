import {
    createGame,
    getUnitAtPosition,
    selectUnit,
    selectWeapon
} from "./game-state.js";

import {
    moveSelectedUnit,
    attackCore,
    attackUnit,
    spawnWeaponDrop
} from "./game-rules.js";

import {
    renderBoard
} from "./render-board.js";

let game = createGame();

// called from renderBoard when player clicks an inventory slot
const onWeaponClick = function (index) {
    game = selectWeapon(index, game);
    rerender();
};

const rerender = function () {
    renderBoard(game, onCellClick, onWeaponClick);
};

// show a flash message for a moment then restore the status text
const flashMessage = function (text) {

    const el = document.getElementById("message");

    if (!el) {
        return;
    }

    const prev = el.textContent;
    el.textContent = text;

    setTimeout(function () {
        // only clear if the game isn't over yet
        if (game.winner === 0) {
            el.textContent = prev;
        }
    }, 1200);
};

/**
 * Main click handler – runs every time a board tile is clicked.
 *
 * Priority order:
 *   1. Select own agent
 *   2. Attack enemy agent (if one is there and a unit is selected)
 *   3. Attack enemy server (core)
 *   4. Move to empty tile
 */
const onCellClick = function (x, y) {

    if (game.winner !== 0) {
        return;  // game over – ignore clicks
    }

    const clicked_unit = getUnitAtPosition(x, y, game);

    // clicking own agent selects / deselects it
    if (clicked_unit && clicked_unit.owner === game.current_player) {
        game = selectUnit(clicked_unit.id, game);
        rerender();
        return;
    }

    // clicking an enemy agent tries to attack it
    if (clicked_unit && clicked_unit.owner !== game.current_player) {
        const result = attackUnit(x, y, game);
        if (result !== game) {
            game = spawnWeaponDrop(result);
            rerender();
            return;
        }
        flashMessage("OUT OF RANGE");
        return;
    }

    // clicking the enemy server tries to attack it
    const after_attack = attackCore(x, y, game);
    if (after_attack !== game) {
        game = spawnWeaponDrop(after_attack);
        rerender();
        return;
    }

    // clicking an empty tile tries to move there
    const after_move = moveSelectedUnit(x, y, game);
    if (after_move !== game) {
        game = spawnWeaponDrop(after_move);
        rerender();
        return;
    }

    flashMessage("ACCESS DENIED");
};

// keyboard shortcuts – Q/E cycle weapons, 1/2/3 select slot directly
document.addEventListener("keydown", function (event) {

    if (game.winner !== 0) {
        return;
    }

    const selected_unit = game.units.find(function (u) {
        return u.id === game.selected_unit_id;
    });

    if (!selected_unit) {
        return;
    }

    let index = game.selected_weapon_index;

    if (event.key === "q") {
        index -= 1;
    }

    if (event.key === "e") {
        index += 1;
    }

    // number keys 1-3 select slot directly
    if (event.key === "1") { index = 0; }
    if (event.key === "2") { index = 1; }
    if (event.key === "3") { index = 2; }

    // wrap around
    if (index < 0) {
        index = selected_unit.inventory.length - 1;
    }

    if (index >= selected_unit.inventory.length) {
        index = 0;
    }

    game = selectWeapon(index, game);
    rerender();
});

rerender();