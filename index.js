const Socket = Java.type("java.net.Socket")
const JavaString = Java.type("java.lang.String")
const Pattern = Java.type("java.util.regex.Pattern")

//TODO: provide this info from elsewhere
let reset = Pattern.compile("^(§r§9Parkour> §r§7Reset your time for §r§eSnake§r§7\.§r)|(§r§9Parkour> §r§7Started §r§eSnake§r§7\.§r)$")
let start = Pattern.compile("^(§r§9Parkour> §r§7Reset your time for §r§eSnake§r§7\.§r)|(§r§9Parkour> §r§7Started §r§eSnake§r§7\.§r)$")
let split = [
    Pattern.compile("^§r§9Parkour> §r§7You completed §r§eSnake§r§7 in §r§e(?<igts>\\d+(\.\\d+)?)§r§7 seconds\.§r$")
]
let enable_igt = true

//state
let cur_split = 0
let igt = 0

let socket = null

function handleChat(msg) {
    let msg = new Message(msg).getFormattedText()
    console.log(msg)
    if (socket && socket.isConnected()) { //only parse chat if theres something to send the result to
        if (reset.matcher(msg).matches()) {
            socket.getOutputStream().write(new JavaString("reset\r\n").getBytes())
            if (igt) {
                socket.getOutputStream().write(new JavaString("initgametime\r\npausegametime\r\n").getBytes())
                igt = 0
            }
            console.log("resetting")
            cur_split = 0
        }
        if (start.matcher(msg).matches()) {
            socket.getOutputStream().write(new JavaString("starttimer\r\n").getBytes())
            console.log("starting")
        }
        if (cur_split == split.length) return
        let splitmatcher = split[cur_split].matcher(msg)
        if (splitmatcher.matches()) {
            cur_split++
            console.log("igt is enabled? " + enable_igt)
            if (enable_igt) {
                let newigt = 0
                try {
                    newigt += parseFloat(splitmatcher.group("igts"))
                } catch(e) {}
                try {
                    newigt += parseFloat(splitmatcher.group("igtm")) * 60
                } catch(e) {}
                try {
                    newigt += parseFloat(splitmatcher.group("igth")) * 3600
                } catch(e) {}
                if (newigt !== 0 && newigt !== igt) {
                    igt = newigt
                    console.log("igt: " + igt.toString())
                    socket.getOutputStream().write(new JavaString("setgametime " + igt.toString() + "\r\n").getBytes())
                }
            }
            socket.getOutputStream().write(new JavaString("split\r\n").getBytes())
        }
    }
}

register("Chat", handleChat)

function handleCmd(msg, event) {
    console.log(msg + ", " + event.toString())
    let args = msg.toLowerCase().split(" ")
    if (["/cs", "/chatsplit"].includes(args[0])) {
        cancel(event)
        if (args[1] in commands) {
            commands[args[1]]["handle"](args.slice(2))
        } else {
            let message = "---\n"
            for (cmd in commands) {
                message += commands[cmd]["desc"] + "\n"
            }
            message += "---"
            ChatLib.chat(message)
        }
    }
}
register('messageSent', handleCmd);

let connect = {
    "handle": (args) => {
        console.log("connect args: " + args.toString())
        try {
            if (args.length > 1) throw new Error("incorrect number of args")
            let [host, port = "16834"] = (args[0] || "localhost:16834").split(":")
            port = parseInt(port)
            console.log("connecting to " + host + ":" + port.toString())
            socket = new Socket(host, port)
            ChatLib.chat('connected to ' + host + ":" + port.toString())
        } catch(err) {
            ChatLib.chat('Couldn\'t connect: ' + err.toString())
        }
    },
    "desc": "/cs connect ip:port connects to a livesplit server"
}

let load = {
    "handle": (args) => {
        console.log("load args: " + args.toString())
        try {
            if (args.length !== 1) throw new Error("incorrect number of args")
            let parsed = JSON.parse(FileLib.read("./config/ChatSplit/" + args[0] + ".json"))
            if (parsed.version !== 1) throw new Error("incompatible splitter version")
            switch (parsed.version) {
                case 1:
                    reset = Pattern.compile(parsed["reset"])
                    start = Pattern.compile(parsed["start"])
                    split = parsed["split"].map(e => Pattern.compile(e))
                    enable_igt = parsed["igt"] || false
                    ChatLib.chat('Loaded ' + args[0])
                    break
                default:
                    throw new Error("incompatible splitter version")
            }
        } catch(err) {
            ChatLib.chat('Couldn\'t connect: ' + err.toString())
        }
    },
    "desc": "/cs load name loads regex definitions into the splitter (reads from .minecraft/config/ChatSplit/<name>.json)"
}

let commands = {
    "connect": connect,
    "load": load,
}

