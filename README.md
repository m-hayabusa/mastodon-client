# Mastodonのクライアントです

## つかいかた:

|コマンド| |
|:----------------------------------------------|-----|
|```select <HTL/LTL/FTL>```                     |表示するタイムラインを選択|
|```t <トゥート>```                              |Tootを投稿|
|```re <ID> <返信>```                           |そのIDのTootに返信する|
|```fav <ID>```                                |そのIDのTootをお気に入りする|
|```bt <ID>```                                 |そのIDのTootをブーストする|
|```set vis <direct/private/unlisted/public>```|投稿の公開範囲を指定する|
|```pause```                                   |タイムラインの表示更新を停止する(取得は続く・通知は表示される)|
|```exit```                                   |終了する|
|```help```                                    |help|

* 行末に¥がある場合､次の行に繋がります
    * Ctrl + C でバッファがクリアされます
    * バッファが空の場合､終了確認が入ります


## Installation

#### Require
- NodeJS

```
git clone git@github.com:hs-sh-net/mastodon-client.git
cd mastodon-client
cp config.sample.js config.js
vi config.js # トークンなど

npm install
node main.js
```

https://github.com/hs-sh-net/botcat-mastodon から一部分コピーしました
