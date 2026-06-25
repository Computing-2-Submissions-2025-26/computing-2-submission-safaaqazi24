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

import {getReachableTiles} from "./game-rules.js";

// ─── SVG helpers ────────────────────────────────────────
// Each returns a raw SVG string to drop inside a tile's innerHTML.
// Using SVG so we get proper scalable graphics without any image assets.

// hexagonal agent body – colour-coded per player
// added the visor rect so it looks like a hacker character
const svgAgent = function (color, highlight_color, status) {

    const dim = (
        status === "slowed"
        ? " opacity=\"0.5\""
        : ""
    );

    const slowed_bar = (
        status === "slowed"
        ? "<rect x=\"5\" y=\"3\" width=\"34\" height=\"6\" rx=\"2\"" +
            " fill=\"#ff8800\" opacity=\"0.8\"/>"
        : ""
    );

    return (
        "<svg width=\"44\" height=\"44\" viewBox=\"0 0 44 44\"" +
        " xmlns=\"http://www.w3.org/2000/svg\"" + dim + ">" +
        // hex body
        "<polygon points=\"22,3 39,12.5 39,31.5 22,41 5,31.5 5,12.5\"" +
        " fill=\"" + color + "\" stroke=\"" + highlight_color +
        "\" stroke-width=\"1.5\"/>" +
        // visor strip
        "<rect x=\"13\" y=\"17\" width=\"18\" height=\"6\" rx=\"2\"" +
        " fill=\"rgba(0,0,0,0.6)\"/>" +
        "<rect x=\"14\" y=\"18\" width=\"16\" height=\"4\" rx=\"1.5\"" +
        " fill=\"" + highlight_color + "\" opacity=\"0.9\"/>" +
        // slowed indicator – orange tint bar at top
        slowed_bar +
        "</svg>"
    );
};

// server rack – horizontal bands with a small LED dot
const svgServer = function (border_color) {
    return (
        "<svg width=\"48\" height=\"48\" viewBox=\"0 0 48 48\"" +
        " xmlns=\"http://www.w3.org/2000/svg\">" +
        "<rect x=\"4\" y=\"5\" width=\"40\" height=\"38\" rx=\"3\"" +
        " fill=\"#0b1a2e\" stroke=\"" + border_color +
        "\" stroke-width=\"1.5\"/>" +
        // rack slots
        "<rect x=\"8\" y=\"11\" width=\"26\" height=\"5\" rx=\"1\"" +
        " fill=\"" + border_color + "\" opacity=\"0.45\"/>" +
        "<rect x=\"8\" y=\"20\" width=\"26\" height=\"5\" rx=\"1\"" +
        " fill=\"" + border_color + "\" opacity=\"0.45\"/>" +
        "<rect x=\"8\" y=\"29\" width=\"26\" height=\"5\" rx=\"1\"" +
        " fill=\"" + border_color + "\" opacity=\"0.45\"/>" +
        // LED indicators
        "<circle cx=\"38\" cy=\"13\" r=\"2.5\" fill=\"#00ff88\"/>" +
        "<circle cx=\"38\" cy=\"22\" r=\"2.5\" fill=\"#00ff88\"" +
        " opacity=\"0.5\"/>" +
        "<circle cx=\"38\" cy=\"31\" r=\"2.5\" fill=\"#ff4444\"" +
        " opacity=\"0.4\"/>" +
        "</svg>"
    );
};

// USB drive shape for data-caches
const svgCache = function () {
    return (
        "<svg width=\"38\" height=\"38\" viewBox=\"0 0 38 38\"" +
        " xmlns=\"http://www.w3.org/2000/svg\">" +
        "<rect x=\"12\" y=\"18\" width=\"14\" height=\"16\" rx=\"2\"" +
        " fill=\"#ffe600\"/>" +
        "<rect x=\"15\" y=\"9\" width=\"8\" height=\"11\" rx=\"1\"" +
        " fill=\"#ccb800\"/>" +
        "<rect x=\"17\" y=\"4\" width=\"4\" height=\"7\" rx=\"1\"" +
        " fill=\"#888\"/>" +
        "<rect x=\"15\" y=\"22\" width=\"8\" height=\"4\" rx=\"1\"" +
        " fill=\"#aa9900\"/>" +
        "</svg>"
    );
};

// firewall tile – brick-style with diagonal cross
const svgFirewall = function () {

    const brick = (
        " rx=\"1\" fill=\"none\" stroke=\"#8b1a00\" stroke-width=\"1.2\"/>"
    );

    return (
        "<svg width=\"86\" height=\"86\" viewBox=\"0 0 86 86\"" +
        " xmlns=\"http://www.w3.org/2000/svg\">" +
        "<rect width=\"86\" height=\"86\" fill=\"#1a0400\"/>" +
        // brick rows – offset every other row
        "<rect x=\"1\"  y=\"1\"  width=\"40\" height=\"18\"" + brick +
        "<rect x=\"43\" y=\"1\"  width=\"42\" height=\"18\"" + brick +
        "<rect x=\"1\"  y=\"21\" width=\"20\" height=\"18\"" + brick +
        "<rect x=\"23\" y=\"21\" width=\"40\" height=\"18\"" + brick +
        "<rect x=\"65\" y=\"21\" width=\"20\" height=\"18\"" + brick +
        "<rect x=\"1\"  y=\"41\" width=\"40\" height=\"18\"" + brick +
        "<rect x=\"43\" y=\"41\" width=\"42\" height=\"18\"" + brick +
        "<rect x=\"1\"  y=\"61\" width=\"20\" height=\"18\"" + brick +
        "<rect x=\"23\" y=\"61\" width=\"40\" height=\"18\"" + brick +
        "<rect x=\"65\" y=\"61\" width=\"20\" height=\"18\"" + brick +
        // diagonal cross
        "<line x1=\"8\" y1=\"8\" x2=\"78\" y2=\"78\" stroke=\"#cc2200\"" +
        " stroke-width=\"1.5\" opacity=\"0.5\"/>" +
        "<line x1=\"78\" y1=\"8\" x2=\"8\" y2=\"78\" stroke=\"#cc2200\"" +
        " stroke-width=\"1.5\" opacity=\"0.5\"/>" +
        // label
        "<text x=\"43\" y=\"50\" text-anchor=\"middle\" fill=\"#cc2200\"" +
        " font-size=\"8\" font-family=\"monospace\" letter-spacing=\"2\"" +
        " opacity=\"0.9\">FIREWALL</text>" +
        "</svg>"
    );
};

// weapon slot badge shown on the unit tile and in inventory
// colour-coded by weapon type so you can tell what's equipped at a glance
const weaponBadgeColor = function (type) {
    if (type === "phishing") {
        return "#ff8c00";
    }
    if (type === "malware") {
        return "#39ff14";
    }
    if (type === "zero_day") {
        return "#ff2244";
    }
    if (type === "emp") {
        return "#cc44ff";
    }
    if (type === "overclock") {
        return "#ffffff";
    }
    return "#4a9fff";  // ping – default blue
};

const weaponBadgeLabel = function (type) {
    if (type === "phishing") {
        return "PHI";
    }
    if (type === "malware") {
        return "MLW";
    }
    if (type === "zero_day") {
        return "0-DAY";
    }
    if (type === "emp") {
        return "EMP";
    }
    if (type === "overclock") {
        return "OCK";
    }
    return "PNG";
};

// checks if the selected agent's active weapon can reach (x, y)
const inAttackRange = function (selected_unit, game, x, y) {
    const active_weapon = (
        selected_unit.inventory[game.selected_weapon_index] ||
        selected_unit.inventory[0]
    );
    if (!active_weapon) {
        return false;
    }
    const range_dist = getDistance(selected_unit.x, selected_unit.y, x, y);
    return range_dist <= active_weapon.range;
};

// ─── Tile builder ──────────
// reachable_tiles is computed once per render pass, then passed in here
const renderTile = function (x, y, game, onCellClick, reachable_tiles) {

    const tile = document.createElement("button");
    tile.className = "tile";
    tile.setAttribute("aria-label", "node " + x + "," + y);

    const unit = getUnitAtPosition(x, y, game);
    const core = getCoreAtPosition(x, y, game);
    const drop = getWeaponAtPosition(x, y, game);
    const wall = getFirewallAtPosition(x, y, game);

    const selected_unit = game.units.find(function (u) {
        return (
            u.id === game.selected_unit_id &&
            u.owner === game.current_player
        );
    });

    const click_handler = function () {
        onCellClick(x, y);
    };

    // green dot on tiles the selected agent can reach (pre-computed BFS list)
    if (
        selected_unit && !unit && !core && !wall &&
        selected_unit.status !== "slowed"
    ) {
        const is_reachable = reachable_tiles.some(function (t) {
            return t.x === x && t.y === y;
        });
        if (is_reachable) {
            tile.classList.add("in-range");
        }
    }

    // pulse enemy server if it's in attack range
    if (
        selected_unit && core && core.owner !== selected_unit.owner &&
        inAttackRange(selected_unit, game, x, y)
    ) {
        tile.classList.add("attackable");
    }

    // highlight enemy units in attack range too
    if (
        selected_unit && unit && unit.owner !== selected_unit.owner &&
        inAttackRange(selected_unit, game, x, y)
    ) {
        tile.classList.add("attackable");
    }

    // ── firewall ───────────────
    if (wall) {
        tile.classList.add("firewall");
        tile.innerHTML = svgFirewall();
        tile.disabled = true;
        tile.addEventListener("click", click_handler);
        return tile;
    }

    // ── server ─────────────
    if (core) {
        const border = (
            core.owner === PLAYER_1
            ? "#3b9dff"
            : "#ff4d4d"
        );
        const core_class = (
            core.owner === PLAYER_1
            ? "core-p1"
            : "core-p2"
        );
        tile.classList.add(core_class);

        const core_hp_pct = Math.max(0, core.hp / 20 * 100);

        tile.innerHTML = (
            svgServer(border) +
            "<div class=\"core-label\">SERVER</div>" +
            "<div class=\"hp-bar-wrap\">" +
            "<div class=\"hp-bar\" style=\"width:" + core_hp_pct +
            "%\"></div>" +
            "</div>" +
            "<div class=\"hp\">" + core.hp + "/20</div>"
        );

        tile.addEventListener("click", click_handler);
        return tile;
    }

    // ── agent ─────────────────────────
    if (unit) {

        const is_selected = unit.id === game.selected_unit_id;
        const color = (
            unit.owner === PLAYER_1
            ? "#1a3d6e"
            : "#6e1a1a"
        );
        const hi_color = (
            unit.owner === PLAYER_1
            ? "#3b9dff"
            : "#ff4d4d"
        );
        const label = (
            unit.owner === PLAYER_1
            ? "AG-01"
            : "AG-02"
        );
        const unit_class = (
            unit.owner === PLAYER_1
            ? "unit-p1"
            : "unit-p2"
        );

        tile.classList.add(unit_class);

        if (is_selected) {
            tile.classList.add("selected");
        }

        // show the currently equipped weapon as a small badge
        const equipped = (
            unit.inventory[game.selected_weapon_index] || unit.inventory[0]
        );
        const badge_col = (
            equipped
            ? weaponBadgeColor(equipped.type)
            : "#4a9fff"
        );
        const badge_lbl = (
            equipped
            ? weaponBadgeLabel(equipped.type)
            : "PNG"
        );

        const unit_hp_pct = unit.hp / unit.max_hp * 100;

        // green blink dot if it's this unit's turn to act
        const active_dot = (
            unit.owner === game.current_player
            ? "<div class=\"active-dot\"></div>"
            : ""
        );

        const hp_bar = (
            "<div class=\"unit-hp-bar\"><div class=\"unit-hp-fill\"" +
            " style=\"width:" + unit_hp_pct + "%;background:" + hi_color +
            "\"></div></div>"
        );

        tile.innerHTML = (
            svgAgent(color, hi_color, unit.status) +
            active_dot +
            "<div class=\"unit-label\">" + label + "</div>" +
            "<div class=\"weapon-badge\" style=\"background:" +
            badge_col + "\">" + badge_lbl + "</div>" +
            hp_bar
        );

        tile.addEventListener("click", click_handler);
        return tile;
    }

    // ── data-cache (weapon drop) ─────────────
    if (drop) {
        tile.classList.add("weapon-drop");
        const w = WEAPONS[drop.type];
        const drop_name = (
            w
            ? w.name
            : drop.type
        );
        tile.innerHTML = (
            svgCache() +
            "<div class=\"drop-label\" style=\"color:" +
            weaponBadgeColor(drop.type) + "\">" +
            drop_name +
            "</div>"
        );
        tile.addEventListener("click", click_handler);
        return tile;
    }

    // empty tile
    tile.addEventListener("click", click_handler);
    return tile;
};

// ─── Inventory sidebar ──────────────────────

const renderInventory = function (game, onWeaponClick) {

    const aside = document.getElementById("inventory");
    aside.innerHTML = "<h3>EXPLOIT TOOLS</h3>";

    const selected_unit = game.units.find(function (u) {
        return u.id === game.selected_unit_id;
    });

    if (!selected_unit) {
        aside.innerHTML += (
            "<p class=\"hint\">Select your agent<br>to view loaded" +
            " exploits.<br><br>Q / E to cycle.</p>"
        );
        return;
    }

    // show status if slowed
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

        const plural = (
            weapon.uses !== 1
            ? "s"
            : ""
        );
        const uses_text = (
            weapon.uses === Infinity
            ? "inf"
            : weapon.uses + " use" + plural
        );

        const badge_col = weaponBadgeColor(weapon.type);

        // show area-effect note for emp
        const extra = (
            weapon.type === "emp"
            ? " / AOE"
            : ""
        );

        btn.innerHTML = (
            "<span class=\"inv-badge\" style=\"background:" + badge_col +
            "\">" +
            weaponBadgeLabel(weapon.type) +
            "</span>" +
            "<span class=\"inv-name\">" + weapon.name + "</span>" +
            "<span class=\"inv-stats\">DMG " + weapon.damage +
            " / RNG " + weapon.range +
            extra +
            " / " + uses_text + "</span>"
        );

        btn.addEventListener("click", function () {
            onWeaponClick(index);
        });

        aside.appendChild(btn);
    });
};

// ─── Comms log ─────────────────────────────
// shows the last few actions so players can see what just happened

const renderCommsLog = function (log) {

    const el = document.getElementById("comms-log");

    if (!el) {
        return;
    }

    el.innerHTML = "<h3>COMMS LOG</h3>";

    if (log.length === 0) {
        el.innerHTML += "<p class=\"hint\">No activity yet.</p>";
        return;
    }

    log.forEach(function (entry) {
        const line = document.createElement("p");
        line.className = "log-entry";
        line.textContent = entry;
        el.appendChild(line);
    });
};

// ─── Status bar ───────────────

const renderStatus = function (game) {

    const status = document.getElementById("status");

    if (!status) {
        return;
    }

    const p1_core = game.cores.find(function (c) {
        return c.owner === PLAYER_1;
    });
    const p2_core = game.cores.find(function (c) {
        return c.owner === PLAYER_2;
    });

    if (game.winner !== 0) {

        status.innerHTML = (
            "<div class=\"winner-banner\">" +
            "AGENT-0" + game.winner + " HAS BREACHED THE NETWORK" +
            "<button id=\"restart-btn\">NEW SESSION</button>" +
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

    // respawn countdowns
    let respawn_text = "";
    game.respawn_queue.forEach(function (entry) {
        respawn_text += (
            " [AG-0" + entry.owner + " RESPAWN IN " + entry.turns_left + "]"
        );
    });

    const p1_active = (
        game.current_player === PLAYER_1
        ? "active-p1"
        : ""
    );
    const p2_active = (
        game.current_player === PLAYER_2
        ? "active-p2"
        : ""
    );
    const respawn_html = (
        respawn_text
        ? "<div class=\"respawn-info\">" + respawn_text + "</div>"
        : ""
    );
    const p1_hp = (
        p1_core
        ? p1_core.hp
        : 0
    );
    const p2_hp = (
        p2_core
        ? p2_core.hp
        : 0
    );

    status.innerHTML = (
        "<div class=\"player-status " + p1_active + "\">" +
        "<span>AGENT-01</span>" +
        "<span class=\"core-hp\">SERVER " + p1_hp + "/20</span>" +
        "</div>" +
        "<div class=\"turn-block\">" +
        "<div>TURN " + (game.turn_count + 1) + "</div>" +
        "<div>AGENT-0" + game.current_player + " EXEC</div>" +
        respawn_html +
        "</div>" +
        "<div class=\"player-status " + p2_active + "\">" +
        "<span>AGENT-02</span>" +
        "<span class=\"core-hp\">SERVER " + p2_hp + "/20</span>" +
        "</div>"
    );
};

// ─── Main render entry point ─────────────

// renders one full row of tiles – called once per row by renderBoard
const renderRow = function (board, y, game, onCellClick, reachable_tiles) {
    let x = 0;
    while (x < game.board_size) {
        board.appendChild(
            renderTile(x, y, game, onCellClick, reachable_tiles)
        );
        x += 1;
    }
};

const renderBoard = function (game, onCellClick, onWeaponClick, log) {

    const board = document.getElementById("board");
    board.innerHTML = "";

    // compute BFS reachable tiles once here and pass to each tile builder
    // avoids calling getReachableTiles 36 times (once per tile)
    const selected_unit = game.units.find(function (u) {
        return (
            u.id === game.selected_unit_id &&
            u.owner === game.current_player
        );
    });

    const reachable_tiles = (
        selected_unit && selected_unit.status !== "slowed"
        ? getReachableTiles(selected_unit, game)
        : []
    );

    let y = 0;
    while (y < game.board_size) {
        renderRow(board, y, game, onCellClick, reachable_tiles);
        y += 1;
    }

    renderInventory(game, onWeaponClick || function () {});
    renderCommsLog(log || []);
    renderStatus(game);
};

export {renderBoard};
