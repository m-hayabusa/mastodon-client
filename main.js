let is_running = 1;
let eti = 0;
let config = require('./config');
let fetch = require('node-fetch');

let reader = require('readline').createInterface({
  input: process.stdin,
  output: process.stdout
});

let WebSocketClient = require('websocket').client;
let client = {
    HTL: new WebSocketClient(),
    LTL: new WebSocketClient(),
    FTL: new WebSocketClient()
};

let isConnected = {HTL: false, LTL: false, FTL: false };
let Active = "";
let list = {}; list.max_id = 0;


let visibility = "public";

let msg = {
    content: function(content){ return content.replace(/<br \/>/g,'\n')
                                              .replace(/<\/p><p>/g,'\n')
                                              .replace(/<("[^"]*"|'[^']*'|[^'">])*>/g,'')
                                              .replace(/(&lt;)/g, '<')
                                              .replace(/(&gt;)/g, '>')
                                              .replace(/(&quot;)/g, '"')
                                              .replace(/(&#39;)/g, "'")
                                              .replace(/(&amp;)/g, '&')
                                              .replace(/(&apos;)/g, '\'')},
    notify:  function(display_name, acct, type, content=''){ return "\x1b[G\x1b[44m" + display_name + " @" + acct + "が\x1b[5m " + type + " \x1b[0m\x1b[44mしました" + (content && ": \n"+content) + "\x1b[0m"},
    footer:  function(id, created_at) { return "\x1b[G\x1b[47m\x1b[30m " + id + ' '.repeat(process.stdout.columns - created_at.length - id.toString().length -2) + created_at + " \x1b[0m"}
};

function commands(line) {
    if (line == '') {

    } else if (line.match(/^(toot|t)/)) {
        post(line.replace(/^(toot|t)/, ""), {}, visibility);
    } else if (line.match(/^fav /)) {
        if (list[line.replace(/^fav /, "")] != null) {
            fav(list[line.replace(/^fav /, "")]);
        } else {
            console.warn("\x1b[41mNG:Fav:wrongID\x1b[49m");
        }
    } else if (line.match(/^bt /)) {
        if (list[line.replace(/^bt /, "")] != null) {
            rt(list[line.replace(/^bt /, "")]);
        } else {
            console.warn("\x1b[41mNG:Fav:wrongID\x1b[49m");
        }
    } else if (line.match(/^re /)) {
        fetchStatus(list[line.replace(/^re /, '').match(/^(\d*)/)[0]], function (json) {
            post('@' + json.account.acct + ' ' + line.replace(/^re \d* /, ''), {in_reply_to_id: list[line.replace(/^re /, '').match(/^(\d*)/)[0]]}, visibility);
            reader.prompt(true);
        });
    } else if (line.match(/^select /)) {
        let input = line.replace(/^select /, "").toUpperCase();
        if (input.match(/^(HTL|LTL|FTL)$/)) {
            if (input == 'FTL' && isConnected['FTL'] == false) {
                client['FTL'].connect("wss://" + config.domain + "/api/v1/streaming/?access_token=" + config.token + "&stream=public");
            } else if (input == 'LTL' && isConnected['LTL'] == false) {
                client['LTL'].connect("wss://" + config.domain + "/api/v1/streaming/?access_token=" + config.token + "&stream=public:local");
            } else if (input == 'HTL' && isConnected['HTL'] == false) {
                client['HTL'].connect("wss://" + config.domain + "/api/v1/streaming/?access_token=" + config.token + "&stream=user");
            }
            Active = input;
            console.log('\x1b[G' + "\x1b[42m" + Active + 'にストリームを切り替えました\x1b[49m');
        } else {
            console.log("\x1b[G\x1b[41m> select (HTL|LTL|FTL)\x1b[0m");
        }
    } else if (line.match(/^pause/)) {
        Active = false;
        console.log('\x1b[G\x1b[46mストリームの表示を停止します\x1b[49m');
    } else if (line.match(/^set /)) {
        line = line.replace(/^set /, '');
        if (line.match(/^vis /)) {
            visibility = line.replace(/^vis /, '');
        }
    } else if (line.match(/^help/)) {
        console.log("\x1b[Gつかいかた: ")
        console.log("\x1b[G > select <HTL|LTL|FTL>");
        console.log("\x1b[G > t <トゥート>");
        console.log("\x1b[G > re <ID> <返信>");
        console.log("\x1b[G > fav <ID>");
        console.log("\x1b[G > bt <ID>");
        console.log("\x1b[G > set vis <direct|private|unlisted|public>");
        console.log("\x1b[G > exit");
        console.log("\x1b[G > pause");
    } else if (line.match(/^exit/)) {
        console.log('\x1b[G\x1b[46m終了します\x1b[49m');
        process.exit(0);
    } else {
        console.log("\x1b[G\x1b[41m不明なコマンドです\x1b[49m");
    }
}

function input() {
    let lines = '';

    reader.on('line', function(line) {
        if (line.match(/\\$/)){
            if (lines == '') {
                lines += line.replace(/\\$/,'');
            } else {
                lines += '\n'+line.replace(/\\$/,'');
            }
        } else {
            if(lines == '') {
                commands(line);
            } else {
                lines += '\n'+line.replace(/\\$/,'');
                commands(lines);
                lines = '';
            }
        }
        reader.prompt(true);
    });

    reader.on('SIGINT', () => {
        if (lines == '') {
            reader.question('終了しますか？ [Y/n] >', (answer) => {
                if (answer == '' || answer.match(/^y(es)?$/i)) process.exit(0);
                reader.prompt(true);
            });
        } else {
            lines = '';
            console.log("入力バッファをクリアしました");
        }
        reader.prompt(true);
    });
}
input();

let onConnect = function(connection, thisConnection) {
    isConnected[thisConnection] = true;
    console.log('\x1b[G\x1b[43mWebSocket Client Connected: ' + thisConnection+ '\x1b[0m');
    reader.prompt(true);

    connection.on('error', function(error) {
        isConnected[thisConnection] = false;
        console.log("\x1b[G\x1b[41mConnection Error: " + error.toString() + "\x1b[0m");
    });
    connection.on('close', function() {
        isConnected[thisConnection] = false;
        console.log('\x1b[G\x1b[41mConnection Closed: ' + thisConnection+ '\x1b[0m');
    });
    connection.on('message', function(message) {
        try {
            if (message.type === 'utf8') {
                // console.log("\x1b[G\x1b[41m");console.log(message);console.log("\x1b[G\x1b[49m");
                let json = JSON.parse(JSON.parse(message.utf8Data).payload);
                let event = JSON.parse(message.utf8Data).event;
                let id = '';
                // console.log("\x1b[G\x1b[41m");console.log(json);console.log("\x1b[G\x1b[49m");
                if (event == "notification") {
                    if (json.type == 'favourite'){
                        console.log("\x1b[G\x1b[41m");console.log(json.status.content);console.log("\x1b[G\x1b[49m");
                        console.log(msg.notify(json.account.display_name, json.account.acct ,"お気に入り", msg.content(json.status.content)));
                    } else if (json.type == 'reblog') {
                        console.log(msg.notify(json.account.display_name, json.account.acct ,"ブースト", msg.content(json.status.content)));
                    } else if (json.type == 'follow'){
                        console.log(msg.notify(json.account.display_name, json.account.acct ,"フォロー"));
                    } else if (json.type == 'mention'){
                        if (list.max_id > 999){ list.max_id = 0; }
                        list[list.max_id] = json.status.id;
                        id = list.max_id;
                        list.max_id = list.max_id + 1;
                        console.log(msg.notify(json.account.display_name, json.account.acct ,"返信", msg.content(json.status.content)));
                    } else {
                        console.log("\x1b[G\x1b[44m" + "何らかの通知があったようです" + "\x1b[0m");
                    }
                    console.log(msg.footer(id,json.created_at));
                }
                if(Active == thisConnection){
                    if (event == "delete") {
                        console.log("\x1b[G\x1b[45m" + json + "番のTootが削除されました" + "\x1b[0m");
                    } else if (event == "update") {
                        // console.log("\x1b[G\x1b[41m");console.log(json.content);console.log("\x1b[G\x1b[49m");
                        if (list.max_id > 999){ list.max_id = 0; }
                        list[list.max_id] = json.id;
                        let id = list.max_id;
                        list.max_id = list.max_id + 1;

                        let header = json.account.display_name +' @'+json.account.acct;

                        if (json.reblog != null){
                            console.log("\x1b[G" + "\x1b[46m" + header + " \x1b[43m BT "
                                                 + "\x1b[42m " + json.reblog.account.display_name +' @'+json.reblog.account.acct + "\x1b[0m");
                            console.log(msg.content(json.reblog.content));
                            console.log(msg.footer(id,json.created_at));
                        } else if (json.sensitive || (json.spoiler_text != null && json.spoiler_text != '')){
                            // console.log("\x1b[G\x1b[41m");console.log(json);console.log("\x1b[G\x1b[49m");

                            console.log("\x1b[G" + "\x1b[46m" + header + "\x1b[0m");
                            console.log("\x1b[47m\x1b[30mCW: \x1b[0m"+json.spoiler_text);
                            console.log(msg.content(json.content));
                            console.log(msg.footer(id,json.created_at));
                        } else if (json.in_reply_to_id != null){
                            let json_orig = json;
                            fetchStatus(json.in_reply_to_id, function(json_fetched){
                                console.log("\x1b[G" + "\x1b[42m" + header + " \x1b[43m >> "
                                                     + "\x1b[44m " + json_fetched.account.display_name +' @'+json_fetched.account.acct + "\x1b[0m");
                                console.log(msg.content(json_orig.content));
                                console.log(msg.footer(id,json_orig.created_at));
                                reader.prompt(true);
                            })
                        } else {
                            // console.log("\x1b[G\x1b[A\x1b[G\x1b[42m" + header + "\x1b[49m\x1b[39m");
                            console.log("\x1b[G" + "\x1b[42m" + header + "\x1b[0m");
                            console.log(msg.content(json.content));
                            console.log(msg.footer(id,json.created_at));
                        }
                    }
                }
                reader.prompt(true);
            }
        } catch (e) {
            console.log (e);
        }
    });
}

console.log('\n'.repeat(process.stdout.rows));

client['HTL'].on('connectFailed', function(error) { console.log('Connect Error: ' + error.toString());});
client['HTL'].on('connect', function(connection){onConnect(connection,'HTL');});
client['HTL'].connect("wss://" + config.domain + "/api/v1/streaming/?access_token=" + config.token + "&stream=user");
Active = 'HTL';

client['LTL'].on('connectFailed', function(error) { console.log('Connect Error: ' + error.toString());});
client['LTL'].on('connect', function(connection){onConnect(connection,'LTL');});

client['FTL'].on('connectFailed', function(error) { console.log('Connect Error: ' + error.toString());});
client['FTL'].on('connect', function(connection){onConnect(connection,'FTL');});

// ここからいろいろ
function fetchStatus(id, callback){
    fetch("https://" + config.domain + "/api/v1/statuses/" + id, {
        headers: {'content-type': 'application/json', 'Authorization': 'Bearer '+config.token},
        method: 'GET'
    }).then(function(response) {
        if(response.ok) {
            return response.json();
        } else {
            throw new Error();
        }
    }).then(function(json_fetched) {
        if (json_fetched["id"]) {
            callback(json_fetched);
        } else {
            console.warn("\x1b[41mNG:Fetch:"+json+"\x1b[0m");
            reader.prompt(true);
        }
    }).catch(function(error) {
        console.warn(error);
        console.warn("\x1b[41mNG:Fetch:SERVER\x1b[0m");
        reader.prompt(true);
    });
}

function fav(id) {
    fetch("https://" + config.domain + "/api/v1/statuses/"+id+"/favourite", {
        headers: {'content-type': 'application/json', 'Authorization': 'Bearer '+config.token},
        method: 'POST'
    }).then(function(response) {
        if(response.ok) {
            return response.json();
        } else {
            throw new Error();
        }
    }).then(function(json) {
        if (json["id"]) {
            console.log("\x1b[G\x1b[43mOK:Fav\x1b[0m");
            reader.prompt(true);
        } else {
            console.warn("\x1b[G\x1b[41mNG:Fav:"+json+"\x1b[0m");
            reader.prompt(true);
        }
    }).catch(function(error) {
        console.warn("\x1b[G\x1b[41mNG:Fav:SERVER\x1b[0m");
        reader.prompt(true);
    });
}

function rt(id) {
    fetch("https://" + config.domain + "/api/v1/statuses/"+id+"/reblog", {
        headers: {'content-type': 'application/json', 'Authorization': 'Bearer '+config.token},
        method: 'POST'
    }).then(function(response) {
        if(response.ok) {
            return response.json();
        } else {
            throw new Error();
        }
    }).then(function(json) {
        if (json["id"]) {
            console.log("\x1b[G\x1b[43mOK:RT\x1b[0m");
            reader.prompt(true);
        } else {
            console.warn("\x1b[G\x1b[41mNG:RT:"+json+"\x1b[0m");
            reader.prompt(true);
        }
    }).catch(function(error) {
        console.warn("\x1b[G\x1b[41mNG:RT:SERVER\x1b[0m");
        reader.prompt(true);
    });
}

function post(value, option = {}, visibility = "public", force) {
    var optiondata = {
        status: value,
        visibility: visibility
    };

    if (option.cw) {
        optiondata.spoiler_text = option.cw;
    }
    if (option.in_reply_to_id) {
        optiondata.in_reply_to_id = option.in_reply_to_id;
    }
    if (is_running || force) {
        fetch("https://" + config.domain + "/api/v1/statuses", {
            headers: {'content-type': 'application/json', 'Authorization': 'Bearer '+config.token},
            method: 'POST',
            body: JSON.stringify(optiondata)
        }).then(function(response) {
            if(response.ok) {
                return response.json();
            } else {
                throw new Error();
            }
        }).then(function(json) {
            if (json["id"]) {
                console.log("\x1b[G\x1b[43mOK:POST\x1b[49m");
                reader.prompt(true);
            } else {
                console.warn("\x1b[41mNG:POST:"+json+"\x1b[49m");
                reader.prompt(true);
            }
        }).catch(function(error) {
            console.warn("\x1b[41mNG:POST:SERVER\x1b[49m");
            reader.prompt(true);
        });
    }
}
