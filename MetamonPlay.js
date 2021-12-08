// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: light-gray; icon-glyph: magic;

/*
2021-12-09
Created by: thucngv
*/

// URLs to make api calls
BASE_URL = "https://metamon-api.radiocaca.com/usm-api";
TOKEN_URL = `${BASE_URL}/login`;
LIST_MONSTER_URL = `${BASE_URL}/getWalletPropertyBySymbol`;
CHANGE_FIGHTER_URL = `${BASE_URL}/isFightMonster`;
START_FIGHT_URL = `${BASE_URL}/startBattle`;
LIST_BATTLER_URL = `${BASE_URL}/getBattelObjects`;
WALLET_PROPERTY_LIST = `${BASE_URL}/getWalletPropertyList`;
LVL_UP_URL = `${BASE_URL}/updateMonster`;
MINT_EGG_URL = `${BASE_URL}/composeMonsterEgg`;

function datetime_now() {
    var formatter = new DateFormatter();
    formatter.dateFormat = "MM/dd/yyyy HH:mm:ss";
    return formatter.string(new Date())
}

function sleep(ms) {
    var timer = new Timer();
    timer.timeInterval = ms;
    return new Promise(r => timer.schedule(r));
}

async function post_formdata(payload, url, headers) {
    var req = new Request(url);
    if (headers != undefined)
        req.headers = headers;

    req.method = "POST";
    if (payload != undefined && payload != null)
        for (const key of Object.keys(payload)) {
            const val = payload[key];
            req.addParameterToMultipart(key, val + "");
        }
    await sleep(500)
    for (var i = 0; i < 5; i++)
        try {
            return await req.loadJSON();
        } catch (err) {
            console.error(err.message);
        }
    return {};
}

function get_battler_score(monster) {
    //Get opponent's power score
    return parseInt(monster["sca"]);
}

function picker_battler(monsters_list) {
    //Picking opponent
    battlers = [];
    monsters_list.forEach(function (m) {
        if (m["rarity"] == "N") battlers.push(m);
    });

    if (battlers.length == 0)
        monsters_list.forEach(function (m) {
            if (m["rarity"] == "R") battlers.push(m);
        });

    var battler = battlers[0]
    var score_min = get_battler_score(battler)
    for (var i = 1; i < battlers.length; i++) {
        var score = get_battler_score(battlers[i]);
        if (score < score_min) {
            battler = battlers[i];
            score_min = score
        }
    }

    return battler
}

function pick_battle_level(level) {
    // pick highest league for given level
    if (level >= 21 && level <= 40)
        return 2;
    else if (level >= 41 && level <= 60)
        return 3;
    return 1;
}
function read_file(filename, from_local) {
    let fileManager = from_local == true ? FileManager.local() : FileManager.iCloud();
    var path = fileManager.documentsDirectory() + "/metamon/" + filename;
    if (fileManager.fileExists(path))
        return fileManager.readString(path);
    return "";
}
function write_file(filename, content, from_local) {
    let fileManager = from_local == true ? FileManager.local() : FileManager.iCloud();
    return fileManager.writeString(fileManager.documentsDirectory() + "/metamon/" + filename, content);
}
function read_wallets(filename, from_local) {
    var str = read_file(filename, from_local);
    var list = [];
    var fields = [];
    const regex = /([a-zA-Z0-9\-]+),([a-zA-Z0-9\-]+),([a-zA-Z0-9\-]+),([a-zA-Z0-9\-]+)/gm;
    let m;
    while ((m = regex.exec(str)) !== null) {
        if (m.index === regex.lastIndex) regex.lastIndex++;
        if (m.index == 0) {
            m.forEach((match, gIndex) => {
                if (gIndex > 0) fields.push(match);
            });
            continue;
        }

        var obj = {};
        m.forEach((match, gIndex) => {
            if (gIndex > 0) obj[fields[gIndex - 1]] = match;
        });
        list.push(obj);
    }

    return list;
}

function write_stats(filename, data, from_local) {
    var content = read_file(filename, from_local);
    if (content.trim() == "") {
        for (const key of Object.keys(data)) {
            content = content + key + ",";
        }
        if (content.length > 0) content = content.substring(0, content.length - 1) + "\n";
    }
    var s = "";
    for (const key of Object.keys(data)) {
        s = s + data[key] + ",";
    }
    if (s.length > 0) {
        s = s.substring(0, s.length - 1) + "\n";
        content = content + s;
    }
    write_file(filename, content, from_local);
}

class MetamonPlayer {
    constructor(address, sign, msg, auto_lvl_up, output_stats) {
        this.no_enough_money = false;
        if (output_stats == undefined || output_stats == null) output_stats = false;
        this.output_stats = output_stats;
        this.total_bp_num = 0;
        this.total_success = 0;
        this.total_fail = 0;
        this.mtm_stats_df = []
        this.token = null;
        this.address = address;
        this.sign = sign;
        if (msg == undefined || msg == null) msg = "Login";
        this.msg = msg;
        if (auto_lvl_up == undefined || auto_lvl_up == null) auto_lvl_up = false;
        this.auto_lvl_up = auto_lvl_up;
    }

    async init_token() {
        //Obtain token for game session to perform battles and other actions
        var payload = { "address": this.address, "sign": this.sign, "msg": this.msg }
        var response = await post_formdata(payload, TOKEN_URL)
        this.token = response["data"]
    }

    async change_fighter(monster_id) {
        //switch to next metamon if you have few
        var payload = {
            "metamonId": monster_id,
            "address": this.address,
        }
        await post_formdata(payload, CHANGE_FIGHTER_URL)
    }

    async list_battlers(monster_id, front) {
        //Obtain list of opponents
        var payload = {
            "address": this.address,
            "metamonId": monster_id,
            "front": front == undefined || front == null ? 1 : front,
        }
        var headers = {
            "accessToken": this.token,
        }
        var response = await post_formdata(payload, LIST_BATTLER_URL, headers)
        var data = response["data"]
        if (data != undefined) return data["objects"];
        return []
    }

    async start_fight(my_monster, target_monster_id, loop_count) {
        //Main method to initiate battles (as many as monster has energy for)
        if (loop_count <= 0) loop_count = 1;
        var success = 0;
        var fail = 0;
        var total_bp_fragment_num = 0;
        var mtm_stats = [];
        var my_monster_id = my_monster["id"];
        var my_monster_token_id = my_monster["tokenId"];
        var my_level = my_monster["level"];
        var my_power = my_monster["sca"];
        var battle_level = pick_battle_level(my_level);

        logMsg += "Fighting...\n"
        logMsg += "--------\n"
        await updateWidget();
        table.reload()
        for (var i = 0; i < loop_count; i++) {
            var payload = {
                "monsterA": my_monster_id,
                "monsterB": target_monster_id,
                "address": this.address,
                "battleLevel": battle_level,
            }
            var headers = {
                "accessToken": this.token
            }
            var response = await post_formdata(payload, START_FIGHT_URL, headers)
            var code = response["code"]
            if (code == "BATTLE_NOPAY") {
                this.no_enough_money = true;
                logMsg += "--------\n"
                break;
            }
            var data = response["data"]
            var fight_result = data["challengeResult"]
            var bp_fragment_num = parseInt(data["bpFragmentNum"])

            logMsg += `Fighting... ${(i + 1)}/${loop_count} ${fight_result ? "Victory" : "Defeat"}\n`
            await updateWidget();
            table.reload()

            if (this.auto_lvl_up) {
                //Try to lvl up
                var res = await post_formdata({ "nftId": my_monster_id, "address": this.address }, LVL_UP_URL, headers)
                var code = res["code"]
                if (code == "SUCCESS") {
                    logMsg += "LVL UP successful! Continue fighting...\n"
                    await updateWidget();
                    table.reload()
                    my_level += 1
                    //Update league level if new level is 21 or 41
                    battle_level = pick_battle_level(my_level)
                }
            }
            this.total_bp_num += bp_fragment_num
            total_bp_fragment_num += bp_fragment_num
            if (fight_result == true) {
                success += 1
                this.total_success += 1
            }
            else {
                fail += 1
                this.total_fail += 1
            }
        }

        var stats = {
            "My metamon id": my_monster_token_id,
            "Competitor id": target_monster_id,
            "League lvl": battle_level,
            "Total battles": loop_count,
            "My metamon power": my_power,
            "My metamon level": my_level,
            "Victories": success,
            "Defeats": fail,
            "Total egg shards": total_bp_fragment_num,
            "Timestamp": datetime_now()
        };
        if (this.output_stats)
            write_stats(this.mtm_stats_file_name, stats, false);


        for (const key of Object.keys(stats)) {
            logMsg += (key + ": " + stats[key] + "\n")
        }
        logMsg += "--------\n"
        await updateWidget();
        table.reload()
    }

    async get_wallet_properties() {
        //Obtain list of metamons on the wallet

        var payload = { "address": this.address, "page": 1, "pageSize": 99999 }
        var headers = {
            "accessToken": this.token
        }
        var response = await post_formdata(payload, WALLET_PROPERTY_LIST, headers)
        if (response["code"] == "SUCCESS")
            return response["data"]["metamonList"]
        return []
    }

    async list_monsters() {
        //Obtain list of metamons on the wallet (deprecated)
        var payload = { "address": this.address, "page": 1, "pageSize": 60, "payType": -6 }
        var headers = { "accessToken": this.token }
        var response = await post_formdata(payload, LIST_MONSTER_URL, headers)
        var monsters = response["data"]["data"]
        return monsters
    }


    async battle(w_name) {
        //Main method to run all battles for the day
        if (w_name == undefined || w_name == null || w_name == '')
            w_name = this.address

        this.summary_file_name = `${w_name}_summary.csv`
        this.mtm_stats_file_name = `${w_name}_stats.csv`
        await this.init_token()

        //var monsters = await this.list_monsters()
        var wallet_monsters = await this.get_wallet_properties()
        logMsg += `Monsters total: ${wallet_monsters.length}\n`
        await updateWidget();
        table.reload()

        var available_monsters = []
        wallet_monsters.forEach(function (monster) {
            if (parseInt(monster["tear"]) > 0) available_monsters.push(monster);
        });

        var stats_l = []
        logMsg += `Available Monsters : ${available_monsters.length}\n`
        await updateWidget();
        table.reload()
        for (var i = 0; i < available_monsters.length; i++) {
            var monster = available_monsters[i];
            var monster_id = monster["id"]
            var tear = parseInt(monster["tear"])
            var level = monster["level"]
            var battlers = await this.list_battlers(monster_id)
            var battler = picker_battler(battlers)
            var target_monster_id = battler["id"]

            await this.change_fighter(monster_id)

            await this.start_fight(monster, target_monster_id, tear)
            if (this.no_enough_money) {
                logMsg += "Not enough u-RACA\n"
                await updateWidget();
                table.reload()
                break
            }
        }

        var total_count = this.total_success + this.total_fail
        var success_percent = 0
        if (total_count > 0)
            success_percent = (this.total_success * 1.0 / total_count) * 100

        if (total_count <= 0) {
            logMsg = logMsg + "No battles to record\n"
            await updateWidget();
            table.reload()
            return
        }

        var stats = {
            "Victories": self.total_success,
            "Defeats": self.total_fail,
            "Win Rate": `${success_percent}%`,
            "Total Egg Shards": self.total_bp_num,
            "Datetime": datetime_now()
        };
        if (this.output_stats)
            write_stats(this.summary_file_name, stats, false);

        logMsg += "--------\n"
        for (const key of Object.keys(stats)) {
            logMsg += (key + ": " + stats[key] + "\n")
        }
        logMsg += "--------\n"
        await updateWidget();
        table.reload()
    }

    async mint_eggs() {
        await this.init_token()
        var headers = {
            "accessToken": this.token
        }
        var payload = { "address": this.address }

        var minted_eggs = 0

        while (true) {
            var res = await post_formdata(payload, MINT_EGG_URL, headers)
            if (res["code"] != "SUCCESS")
                break
            minted_eggs += 1
        }
        logMsg = logMsg + `Minted Eggs Total: ${minted_eggs}\n`
        await updateWidget();
        table.reload()
    }

}

var logMsg = "";
var options = [false, false, true, true];
var readyFight = false
var isFighting = false
var endGame = -1
async function updateWidget() {
    table.removeAllRows()
    let row = new UITableRow()
    row.height = 60
    var cells = ["no lvup", "skip battles", "mint eggs", "save results"];
    for (let cn = 0; cn < cells.length; cn++) {
        let cell = row.addText(cells[cn])
        cell.centerAligned()
    }
    let row0 = new UITableRow()
    row0.height = 150
    let cell0 = row0.addImageAtURL("https://metamon.radiocaca.com/img_logo.png")
    cell0.centerAligned()
    table.addRow(row0)
    table.addRow(row)

    let row1 = new UITableRow()
    for (let cn = 0; cn < options.length; cn++) {
        let cell = row1.addButton(options[cn] ? "☺" : "☹");
        cell.titleFont = Font.largeTitle()
        cell.centerAligned()
        cell.onTap = function () {
            options[cn] = !options[cn]
            updateWidget();
            table.reload()
        }
    }
    table.addRow(row1)
    if (endGame == -1 && readyFight && !isFighting) {
        let row2 = new UITableRow()
        row2.height = 70
        row2.dismissOnSelect = false
        //let cell = row2.addButton("【 ⚡ FIGHT ⚡ 】");
        let cell = row2.addImageAtURL("https://pixelartmaker-data-78746291193.nyc3.digitaloceanspaces.com/image/d46e893757704e4.png")
        cell.centerAligned()
        row2.onSelect = async function () {
            if (!isFighting) {
                endGame = 0
                await fight(true)
            }
        }
        table.addRow(row2)
    }
    else if (endGame == 0 && readyFight && isFighting) {
        let row2 = new UITableRow()
        row2.height = 100
        let cell = row2.addImageAtURL("https://i.gifer.com/ZWdx.gif")
        cell.centerAligned()
        table.addRow(row2)
    }

    if (logMsg != '') {
        let row3 = new UITableRow()
        row3.height = logMsg.split(/\r\n|\r|\n/).length * 27
        let cell = row3.addText(logMsg);
        table.addRow(row3)
    }
}

let table = new UITable()
await updateWidget();
table.present(true)

async function fight(r) {
    var wallets = read_wallets("wallets.csv", false);
    if (wallets.length == 0) {
        var alert = new Alert();
        alert.message = "wallets.csv file can't be found.";
        alert.present();
    } else {
        readyFight = true;
        await updateWidget();
        table.reload()

        if (r) {
            isFighting = true;
            for (var i = 0; i < wallets.length; i++) {
                var wallet = wallets[i];
                var mtm = new MetamonPlayer(wallet["address"], wallet["sign"], wallet["msg"], !options[0], options[3]);
                if (!options[1])
                    await mtm.battle(wallet["name"])
                if (options[2])
                    await mtm.mint_eggs()
            }
            endGame = 1
            await updateWidget();
            table.reload()
            var alert = new Alert()
            alert.message = "Done!";
            alert.present()
        }
    }
}
await fight(false);
