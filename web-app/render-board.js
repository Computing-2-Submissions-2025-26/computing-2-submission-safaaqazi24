import {
    getDistance,
    getUnitAtPosition,
    getCoreAtPosition,
    getWeaponAtPosition,
    getFirewallAtPosition,
    WEAPONS,
    PLAYER_1,
    PLAYER_2
} from "./game-state.js";

// colour-coded badge for each weapon type shown on unit tiles and inventory
const weaponBadgeColor = function (type) {
    if (type === "phishing")  { return "#ff8c00"; }
    if (type === "malware")   { return "#39ff14"; }
    if (type === "zero_day")  { return "#ff2244"; }
    if (type === "overclock") { return "#ffffff"; }
    return "#4a9fff";
};

const weaponBadgeLabel = function (type) {
    if (type === "phishing")  { return "PHI"; }
    if (type === "malware")   { return "MLW"; }
    if (type === "zero_day")  { return "0-DAY"; }
    if (type === "overclock") { return "OCK"; }
    return "PNG";
};

// ─── Tile builder ─────────────────────────────────────────────────────────────

const renderTile = function (x, y, game, onCellClick) {

    const tile = document.createElement("button");
    tile.className = "tile";

    const unit = getUnitAtPosition(x, y, game);
    const core = getCoreAtPosition(x, y, game);
    const drop = getWeaponAtPosition(x, y, game);
    const wall = getFirewallAtPosition(x, y, game);

    const selected_unit = game.units.find(function (u) {
        return u.id === game.selected_unit_id;
    });

    // build a descriptive label so screen readers announce what is on the tile
    let aria_desc = "node " + x + "," + y;
    if (wall) { aria_desc += ", firewall"; }
    if (core) { aria_desc += ", " + (core.owner === PLAYER_1 ? "player 1" : "player 2") + " server, " + core.hp + " HP"; }
    if (unit) { aria_desc += ", " + (unit.owner === PLAYER_1 ? "agent 01" : "agent 02") + ", " + unit.hp + " HP"; }
    if (drop) { aria_desc += ", data cache: " + drop.type; }
    tile.setAttribute("aria-label", aria_desc);

    // highlight tiles within movement range of the selected agent
    if (selected_unit && !unit && !core && !wall) {
        const dist = getDistance(selected_unit.x, selected_unit.y, x, y);
        if (dist <= selected_unit.movement && selected_unit.status !== "slowed") {
            tile.classList.add("in-range");
        }
    }

    // pulse enemy targets in weapon range
    if (selected_unit && (core || unit)) {
        const target_owner = core ? core.owner : unit.owner;
        if (target_owner !== selected_unit.owner) {
            const weapon = selected_unit.inventory[game.selected_weapon_index];
            if (weapon) {
                const dist = getDistance(selected_unit.x, selected_unit.y, x, y);
                if (dist <= weapon.range) {
                    tile.classList.add("attackable");
                }
            }
        }
    }

    // ── firewall ──────────────────────────────────────────────────────────────
    if (wall) {
        tile.classList.add("firewall");
        tile.innerHTML = '<img src="./assets/firewall.svg" class="tile-icon" alt="firewall">';
        tile.disabled = true;
        tile.addEventListener("click", function () { onCellClick(x, y); });
        return tile;
    }

    // ── server ────────────────────────────────────────────────────────────────
    if (core) {
        const src = core.owner === PLAYER_1 ? "./assets/server-p1.svg" : "./assets/server-p2.svg";
        tile.classList.add(core.owner === PLAYER_1 ? "core-p1" : "core-p2");

        const hp_pct = Math.max(0, core.hp / 20 * 100);

        tile.innerHTML = (
            '<img src="' + src + '" class="tile-icon" alt="server">' +
            '<div class="core-label">SERVER</div>' +
            '<div class="hp-bar-wrap"><div class="hp-bar" style="width:' + hp_pct + '%"></div></div>' +
            '<div class="hp">' + core.hp + "/20</div>"
        );

        tile.addEventListener("click", function () { onCellClick(x, y); });
        return tile;
    }

    // ── agent ─────────────────────────────────────────────────────────────────
    if (unit) {

        const is_selected = unit.id === game.selected_unit_id;
        const hi_color    = unit.owner === PLAYER_1 ? "#3b9dff" : "#ff4d4d";
        const label       = unit.owner === PLAYER_1 ? "AG-01" : "AG-02";
        const src         = unit.owner === PLAYER_1 ? "./assets/agent-p1.svg" : "./assets/agent-p2.svg";

        tile.classList.add(unit.owner === PLAYER_1 ? "unit-p1" : "unit-p2");

        if (is_selected) {
            tile.classList.add("selected");
        }

        // dim the icon if the agent is slowed this turn
        const icon_class = unit.status === "slowed" ? "tile-icon slowed-icon" : "tile-icon";

        const weapon    = unit.inventory[game.selected_weapon_index] || unit.inventory[0];
        const badge_col = weapon ? weaponBadgeColor(weapon.type) : "#4a9fff";
        const badge_lbl = weapon ? weaponBadgeLabel(weapon.type) : "PNG";
        const hp_pct    = unit.hp / unit.max_hp * 100;

        const active_dot = (unit.owner === game.current_player)
            ? '<div class="active-dot"></div>'
            : "";

        tile.innerHTML = (
            '<img src="' + src + '" class="' + icon_class + '" alt="' + label + '">' +
            active_dot +
            '<div class="unit-label">' + label + "</div>" +
            '<div class="weapon-badge" style="background:' + badge_col + '">' + badge_lbl + "</div>" +
            '<div class="unit-hp-bar"><div class="unit-hp-fill" style="width:' + hp_pct + "%;background:" + hi_color + '"></div></div>'
        );

        tile.addEventListener("click", function () { onCellClick(x, y); });
        return tile;
    }

    // ── data-cache ────────────────────────────────────────────────────────────
    if (drop) {
        const w = WEAPONS[drop.type];
        tile.classList.add("weapon-drop");
        tile.innerHTML = (
            '<img src="./assets/cache.svg" class="tile-icon" alt="data cache">' +
            '<div class="drop-label" style="color:' + weaponBadgeColor(drop.type) + '">' +
            (w ? w.name : drop.type) +
            "</div>"
        );
        tile.addEventListener("click", function () { onCellClick(x, y); });
        return tile;
    }

    // empty tile
    tile.addEventListener("click", function () { onCellClick(x, y); });
    return tile;
};

// ─── Inventory sidebar ────────────────────────────────────────────────────────

const renderInventory = function (game, onWeaponClick) {

    const aside = document.getElementById("inventory");
    aside.innerHTML = "<h3>EXPLOIT TOOLS</h3>";

    const selected_unit = game.units.find(function (u) {
        return u.id === game.selected_unit_id;
    });

    if (!selected_unit) {
        aside.innerHTML += '<p class="hint">Select your agent<br>to view loaded exploits.<br><br>Q / E to cycle.</p>';
        return;
    }

    if (selected_unit.status === "slowed") {
        const warn = document.createElement("p");
        warn.className = "status-warn";
        warn.textContent = "SLOWED – cannot move this turn";
        aside.appendChild(warn);
    }

    selected_unit.inventory.forEach(function (weapon, index) {

        const btn = document.createElement("button");
        btn.className = "inventory-item";

        if (index === game.selected_weapon_index) {
            btn.classList.add("active");
        }

        const uses_text = weapon.uses === Infinity
            ? "inf"
            : weapon.uses + " use" + (weapon.uses !== 1 ? "s" : "");

        const badge_col = weaponBadgeColor(weapon.type);

        const stats_text = weapon.movement_boost
            ? "MOVE +" + weapon.movement_boost + " tiles / " + uses_text
            : "DMG " + weapon.damage + " / RNG " + weapon.range + " / " + uses_text;

        btn.innerHTML = (
            '<span class="inv-badge" style="background:' + badge_col + '">' +
            weaponBadgeLabel(weapon.type) +
            "</span>" +
            '<span class="inv-name">' + weapon.name + "</span>" +
            '<span class="inv-stats">' + stats_text + "</span>"
        );

        btn.addEventListener("click", function () {
            onWeaponClick(index);
        });

        aside.appendChild(btn);
    });
};

// ─── Status bar ───────────────────────────────────────────────────────────────

const renderStatus = function (game) {

    const status = document.getElementById("status");

    if (!status) {
        return;
    }

    const p1_core = game.cores.find(function (c) { return c.owner === PLAYER_1; });
    const p2_core = game.cores.find(function (c) { return c.owner === PLAYER_2; });

    if (game.winner !== 0) {

        status.innerHTML = (
            '<div class="winner-banner">' +
            "AGENT-0" + game.winner + " HAS BREACHED THE NETWORK" +
            '<button id="restart-btn">NEW SESSION</button>' +
            "</div>"
        );

        const btn = document.getElementById("restart-btn");
        if (btn) {
            btn.addEventListener("click", function () {
                window.location.reload();
            });
        }

        return;
    }

    let respawn_text = "";
    game.respawn_queue.forEach(function (entry) {
        respawn_text += " [AG-0" + entry.owner + " RESPAWN IN " + entry.turns_left + "]";
    });

    status.innerHTML = (
        '<div class="player-status ' + (game.current_player === PLAYER_1 ? "active-p1" : "") + '">' +
        "<span>AGENT-01</span>" +
        '<span class="core-hp">SERVER ' + (p1_core ? p1_core.hp : 0) + "/20</span>" +
        "</div>" +
        '<div class="turn-block">' +
        "<div>TURN " + (game.turn_count + 1) + "</div>" +
        "<div>AGENT-0" + game.current_player + " EXEC</div>" +
        (respawn_text ? '<div class="respawn-info">' + respawn_text + "</div>" : "") +
        "</div>" +
        '<div class="player-status ' + (game.current_player === PLAYER_2 ? "active-p2" : "") + '">' +
        "<span>AGENT-02</span>" +
        '<span class="core-hp">SERVER ' + (p2_core ? p2_core.hp : 0) + "/20</span>" +
        "</div>"
    );
};

// ─── Main render entry point ──────────────────────────────────────────────────

const renderBoard = function (game, onCellClick, onWeaponClick) {

    const board = document.getElementById("board");
    board.innerHTML = "";

    for (let y = 0; y < game.board_size; y += 1) {
        for (let x = 0; x < game.board_size; x += 1) {
            board.appendChild(renderTile(x, y, game, onCellClick));
        }
    }

    renderInventory(game, onWeaponClick || function () {});
    renderStatus(game);
};

export { renderBoard };