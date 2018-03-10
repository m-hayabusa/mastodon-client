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
    content: function(content){ return content.replace(/<br \/>/,'\n')
                                                       .replace(/<("[^"]*"|'[^']*'|[^'">])*>/g,'')
                                                       .replace(/(&lt;)/g, '<')
                                                       .replace(/(&gt;)/g, '>')
                                                       .replace(/(&quot;)/g, '"')
                                                       .replace(/(&#39;)/g, "'")
                                                       .replace(/(&amp;)/g, '&')
                                                       .replace(/(&apos;)/g, '\'')},
    notify:  function(display_name, acct, type, content=''){ return "\x1b[G\x1b[44m" + display_name + " @" + acct + "が\x1b[5m " + type + " \x1b[0m\x1b[44mしました" + (content && ": \n"+content) + "\x1b[0m"},
    footer:  function(id, created_at) { return "\x1b[G\x1b[47m\x1b[30m " + created_at + ' '.repeat(process.stdout.columns - created_at.length - id.toString().length -2) + id + " \x1b[0m"}
};

function input() {
    var lines = [];

    reader.on('line', function(line) {
        if (line.match(/^(toot |t )/)){
            post(line.replace(/^(toot |t )/, ""), {}, visibility);
        } else if (line.match(/^fav /)){
            if (list[line.replace(/^fav /, "")] != null){
                fav(list[line.replace(/^fav /, "")]);
            } else {
                console.warn("\x1b[41mNG:Fav:wrongID\x1b[49m");
            }
        } else if (line.match(/^bt /)){
            if (list[line.replace(/^bt /, "")] != null){
                rt(list[line.replace(/^bt /, "")]);
            } else {
                console.warn("\x1b[41mNG:Fav:wrongID\x1b[49m");
            }
        } else if (line.match(/^re /)){
            fetch("https://" + config.domain + "/api/v1/statuses/" + list[line.replace(/^re /,'').match(/^(\d*)/)[0]], {
                headers: {'content-type': 'application/json', 'Authorization': 'Bearer '+config.token},
                method: 'GET'
            }).then(function(response) {
                if(response.ok) {
                    return response.json();
                } else {
                    throw new Error();
                }
            }).then(function(json) {
                if (json["id"]) {
                    console.log("\x1b[G\x1b[43mOK:Fetch\x1b[49m");
                    post('@'+json.account.acct + ' ' + line.replace(/^re \d* /, ''), {in_reply_to_id:list[line.replace(/^re /,'').match(/^(\d*)/)[0]]}, visibility);
                    reader.prompt(true);
                } else {
                    console.warn("\x1b[41mNG:Fetch:"+json+"\x1b[49m");
                }
            }).catch(function(error) {
                console.warn("\x1b[41mNG:Fetch:SERVER\x1b[49m");
            });
        } else if (line.match(/^select /)) {
            if (line.replace(/^select /,"") == 'FTL' && isConnected['FTL'] == false){
                client['FTL'].connect("wss://" + config.domain + "/api/v1/streaming/?access_token=" + config.token + "&stream=public");
            } else if (line.replace(/^select /,"") == 'LTL' && isConnected['LTL'] == false){
                client['LTL'].connect("wss://" + config.domain + "/api/v1/streaming/?access_token=" + config.token + "&stream=public:local");
            }
            Active = line.replace(/^select /,"");
            console.log('\x1b[G' + "\x1b[42m" + Active + 'にストリームを切り替えました\x1b[49m');
        } else if (line.match(/^pause/)) {
            Active = false;
            console.log('\x1b[G\x1b[46mストリームの表示を停止します\x1b[49m');
        } else if (line.match(/^set /)) {
            line = line.replace(/^set /,'');
            if (line.match(/^vis /)) {
                visibility = line.replace(/^vis /,'');
            }
        } else if (line.match(/^help/)) {
            console.log("\x1b[Gつかいかた: ")
            console.log("\x1b[G > select <HTL|LTL|FTL>");
            console.log("\x1b[G > t <トゥート>");
            console.log("\x1b[G > re <ID> <返信>");
            console.log("\x1b[G > fav <ID>");
            console.log("\x1b[G > bt <ID>");
            console.log("\x1b[G > set vis <direct|private|unlisted|public>");
            console.log("\x1b[G > pause");
        } else {
          console.log("\x1b[G\x1b[41m不明なコマンドです\x1b[49m");
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
                // console.log("\x1b[G\x1b[41m");console.log(json);console.log("\x1b[G\x1b[49m");
                if (event == "notification") {
                    if (json.type == 'favourite'){
                        console.log(msg.notify(json.account.display_name, json.account.acct ,"お気に入り", msg.content(json.status.content)));
                    } else if (json.type == 'reblog') {
                        console.log(msg.notify(json.account.display_name, json.account.acct ,"ブースト", msg.content(json.status.content)));
                    } else if (json.type == 'follow'){
                        console.log(msg.notify(json.account.display_name, json.account.acct ,"フォロー"));
                    } else if (json.type == 'mention'){
                        console.log(msg.notify(json.account.display_name, json.account.acct ,"返信", msg.content(json.status.content)));
                    } else {
                        console.log("\x1b[G\x1b[44m" + "何らかの通知があったようです" + "\x1b[0m");
                    }
                    console.log(msg.footer(json.id,json.created_at));
                }
                if(Active == thisConnection){
                    if (event == "delete") {
                        console.log("\x1b[G\x1b[45m" + json + "番のTootが削除されました" + "\x1b[0m");

                    } else if (event == "update") {
                        // console.log("\x1b[G\x1b[41m");console.log(json);console.log("\x1b[G\x1b[49m");
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
                            let content = json.content
                            fetch("https://" + config.domain + "/api/v1/statuses/" + json.in_reply_to_id, {
                                headers: {'content-type': 'application/json', 'Authorization': 'Bearer '+config.token},
                                method: 'GET'
                            }).then(function(response) {
                                if(response.ok) {
                                    return response.json();
                                } else {
                                    throw new Error();
                                }
                            }).then(function(json) {
                                if (json["id"]) {
                                    // console.log("\x1b[G\x1b[43mOK:Fetch\x1b[49m");
                                    console.log("\x1b[G" + "\x1b[42m" + header + " \x1b[43m >> "
                                                         + "\x1b[44m " + json.account.display_name +' @'+json.account.acct + "\x1b[0m");
                                    console.log(msg.content(content));
                                    console.log(msg.footer(id,json.created_at));

                                } else {
                                    console.warn("\x1b[41mNG:Fetch:"+json+"\x1b[0m");
                                }
                            }).catch(function(error) {
                                console.warn("\x1b[41mNG:Fetch:SERVER\x1b[0m");
                            });

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
        } else {
            console.warn("\x1b[G\x1b[41mNG:Fav:"+json+"\x1b[0m");
        }
    }).catch(function(error) {
        console.warn("\x1b[G\x1b[41mNG:Fav:SERVER\x1b[0m");
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
        } else {
            console.warn("\x1b[G\x1b[41mNG:RT:"+json+"\x1b[0m");
        }
    }).catch(function(error) {
        console.warn("\x1b[G\x1b[41mNG:RT:SERVER\x1b[0m");
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
            } else {
                console.warn("\x1b[41mNG:POST:"+json+"\x1b[49m");
            }
        }).catch(function(error) {
            console.warn("\x1b[41mNG:POST:SERVER\x1b[49m");
        });
    }
}
