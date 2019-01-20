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
let Active = {HTL: false, LTL: false, FTL: false };
let list = new Map();
let log = new Map();


let visibility = "public";

let msg = {
    content: function(content){ return content.replace(/<br( \/)?>/g,'\n')
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
        let id = line.replace(/^fav /, "");
        if (list.has(id)) {
            fav(log.get(list.get(id)).id);
        } else {
            console.warn("\x1b[41mNG:Fav:wrongID\x1b[49m");
        }
    } else if (line.match(/^bt /)) {
        let id = line.replace(/^bt /, "");
        if (list.has(id)) {
            rt(log.get(list.get(id)).id);
        } else {
            console.warn("\x1b[41mNG:BT:wrongID\x1b[49m");
        }
    } else if (line.match(/^re /)) {
        let id = line.replace(/^re /, '').match(/^(\d*)/)[0];
        if (list.has(id) && log.has(list.get(id))) {
            let acct = log.get(list.get(id)).account.acct;
            post('@' + acct + ' ' + line.replace(/^re \d* /, ''), {in_reply_to_id: list.get(id)}, visibility);
        } else {
            console.warn("\x1b[41mNG:Re:wrongID\x1b[49m");
        }
    } else if (line.match(/^del /)) {
        let id = line.replace(/^del /, "");
        if (list.has(id)) {
            del(log.get(list.get(id)).id);
        } else {
            console.warn("\x1b[41mNG:Del:wrongID\x1b[49m");
        }
    } else if (line.match(/^select /)) {
        let input = line.replace(/^select /, "").toUpperCase();
        if (input.match(/(HTL|LTL|FTL)/)) {
            if (input.match(/FTL/)) {
                Active.FTL = true;
                if (isConnected['FTL'] === false) {
                    client['FTL'].connect("wss://" + config.domain + "/api/v1/streaming/?access_token=" + config.token + "&stream=public");
                }
            } else {
                Active.FTL = false;
            }

            if (input.match(/LTL/)) {
                Active.LTL = true;
                if (isConnected['LTL'] === false) {
                    client['LTL'].connect("wss://" + config.domain + "/api/v1/streaming/?access_token=" + config.token + "&stream=public:local");
                }
            } else {
                Active.LTL = false;
            }

            if (input.match(/HTL/)) {
                Active.HTL = true;
                if (isConnected['HTL'] === false) {
                    client['HTL'].connect("wss://" + config.domain + "/api/v1/streaming/?access_token=" + config.token + "&stream=user");
                }
            } else {
                Active.HTL = false;
            }

            console.log('\x1b[G' + "\x1b[42m" + input + 'にストリームを切り替えました\x1b[49m');
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
    } else if (line.match(/^f /)) {
        try {
            console.log(eval(line.replace(/^f /, '')));
        } catch(e) {
            console.log(e);
        }
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
                let json = JSON.parse(JSON.parse(message.utf8Data).payload);
                let event = JSON.parse(message.utf8Data).event;
                let id = '';
                if (event == "notification") {
                    if (json.type == 'favourite'){
                        console.log(msg.notify(json.account.display_name, json.account.acct ,"お気に入り", msg.content(json.status.content)));
                    } else if (json.type == 'reblog') {
                        console.log(msg.notify(json.account.display_name, json.account.acct ,"ブースト", msg.content(json.status.content)));
                    } else if (json.type == 'follow'){
                        console.log(msg.notify(json.account.display_name, json.account.acct ,"フォロー"));
                    } else if (json.type == 'mention'){
                        log.set(json.id, json);
                        let id = log.size +'';
                        list.set(id, json.id);

                        console.log(msg.notify(json.account.display_name, json.account.acct ,"返信", msg.content(json.status.content)));
                    } else {
                        console.log("\x1b[G\x1b[44m" + "何らかの通知があったようです" + "\x1b[0m");
                    }
                    console.log(msg.footer(id,json.created_at));
                }
                if(Active[thisConnection] == true){
                    if (event == "delete") {
                        id = JSON.parse(message.utf8Data).payload;
                        console.log("\x1b[G\x1b[45m" + id + "番のTootが削除されました" + "\x1b[0m");
                        if (log.has(id)){
                            let data = log.get(id);
                            console.log(msg.content(data.content));
                            console.log(msg.footer('',data.created_at));
                        }
                    } else if (event == "update" && !log.has(json.id)) {
                        log.set(json.id, json);
                        let id = log.size +'';
                        list.set(id, json.id);

                        let header = json.account.display_name +' @'+json.account.acct;

                        if (json.reblog != null){
                            console.log("\x1b[G" + "\x1b[46m" + header + " \x1b[43m BT "
                                                 + "\x1b[42m " + json.reblog.account.display_name +' @'+json.reblog.account.acct + "\x1b[0m");
                            console.log(msg.content(json.reblog.content));
                            console.log(msg.footer(id,json.created_at));
                        } else if (json.sensitive || (json.spoiler_text != null && json.spoiler_text != '')){
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
Active.HTL = true;

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

function del(id) {
    fetch("https://" + config.domain + "/api/v1/statuses/"+id, {
        headers: {'content-type': 'application/json', 'Authorization': 'Bearer '+config.token},
        method: 'DELETE'
    }).then(function(response) {
        if(response.ok) {
            console.log("\x1b[G\x1b[43mOK:Del\x1b[0m");
            reader.prompt(true);
            return response.json();
        } else {
            throw new Error();
        }
    }).catch(function(error) {
        console.warn("\x1b[G\x1b[41mNG:Del\x1b[0m");
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

function post(value, option = {}, visibility = "public") {
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
