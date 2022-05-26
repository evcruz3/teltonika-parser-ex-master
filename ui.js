const Parser = require('./utilities/teltonika-parser');
const binutils = require('binutils64');
const net = require('net');
const ByteBuffer = require("bytebuffer");
const Devices = require('./device/devices')
const prompt = require('prompt-sync')
const crc16ibm = require('./utilities/crc16ibm')
const GprsCommandPacker = require("./utilities/gprsCommandPacker")
const fs = require('fs')
const myRL = require("serverline");

const originalConsoleLog = console.log;
console.log = function() {
    args = [];
    args.push( '[' + (new Date().toLocaleString("en-US", {timeZone: "Asia/Manila"})) + '] ' );
    // Note: arguments is part of the prototype
    for( var i = 0; i < arguments.length; i++ ) {
        args.push( arguments[i] );
    }
    originalConsoleLog.apply( console, args );
};

class UI{
    constructor (){
        //this.devices = new Devices()
        var _inst = this

        process.stdout.write("\x1Bc")
        console.log(Array(process.stdout.rows + 1).join('\n'));

        myRL.init()
        myRL.setCompletion(['sendCommand', 'listDevices', 'setDeviceName']);
        myRL.on('line', function(d) {
            let devlist_path = ('./device/devlist.json')
            let devlist_json = require(devlist_path)
            let devices = {}
            

            for (const [key, device] of Object.entries(devlist_json['devices'])) {
                devices[device.id] = device.name
            }

            let user_input = d.toString().trim()
            //console.log("you entered: [" +    user_input + "]");
            let [ui_command, tmp, ...others] = user_input.split(" ");
            let message = others.join(" ");

            //console.log("Command: " + comm);
            //console.log("ID: " + id);
            //console.log("Message: " + message);

            if (ui_command == "sendCommand"){
                _inst.client.write(d)
            }
            else if (ui_command == "listDevices"){
                //console.log("TODO: list all devices here and their status")
                _inst.client.write(d)
            }
            else if (ui_command == "displayLog"){
                if(isNaN(tmp)){
                    var id = Object.keys(devices).find(key => devices[key] === tmp);
                } 
                else{
                    var id = tmp
                }

                if(id in devices){
                    if(others[0]){
                        _inst._displayLog(id, _inst, others[0])
                    }
                    else{
                        _inst._displayLog(id, _inst)
                    }
                    
                }
                else{
                    console.log("Device not found / specified")
                }
            }
            else if (ui_command == "setDeviceName"){
                _inst.client.write(d)
            }
            
            
        });

        // Port 49365 for sending ui commands to logger module
        this.client = new net.Socket();

        this.client.connect(49365, 'localhost', () => {
            console.log("Created a connection to ui node")
        })

        this.client.on('data', (data) => {     
            console.log(`Client received: ${data}`); 
            if (data.toString().endsWith('exit')) { 
                client.destroy(); 
            } 
        });  
        // Add a 'close' event handler for the client socket 
        this.client.on('close', () => { 
            console.log('logger closed'); 
        });  
        this.client.on('error', (err) => { 
            console.error(err); 
        }); 

        

    }

    _displayLog(id, _inst, n=-1){
        //let devices = new Devices()
        //devices.addDevice(null, null, id)
        let path = `devlogs/${id}/`
        let filename = path + "dev"+id+"-log.txt"

        if(n && n>0){
            let lineReader = require('read-last-lines')
            // lineReader.read(filename, n).then((lines) => lines.forEach(element => {
            //     this._parseLine(element);
            // }))
            let lines = lineReader.read(filename, n).then((lines) => {
                let data = lines.split(/\r?\n/)
                for (const [_, val] of Object.entries(data)) {
                    _inst._parseLine(val, _inst);
                }
            }, reason => {
                console.error(reason)
            })
        }
        else{
            let lineReader = require('readline').createInterface({
                input: require('fs').createReadStream(filename)
              });
              
              lineReader.on('line', function(data) {
                _inst._parseLine(data, _inst);
              } );
        }
    }

    _parseLine (data, _inst) {
        let buffer = Buffer.from(data, "hex");
        let parser = new Parser(buffer);
        
        let header = parser.getHeader();
        
        if(header.codec_id == 142){
            let avl = parser.getAvl()

            console.log("AVL DATA")
            for (var i = 0; i < avl.number_of_data; i++) {
                _inst._printAvlRecord(avl.records, i);
            }
            console.log()
        }
    }

    _printAvlRecord(avlRecords, index){
        let avlRecord = avlRecords[index]
  
        //console.log("KEYS: " + Object.keys(avlRecord))
        console.log("Timestamp: " + avlRecord.timestamp)
        console.log("Priority: " + avlRecord.priority)
        for (const [key, value] of Object.entries(avlRecord.gps)) {
            console.log(`GPS ${key}: ${value}`);
            if (key == "valueHuman" && value){
                
                for (const [property, val] of Object.entries(value)) {
                    console.log(`GPS ${key} ${value} ${property} : ${val}`);
                }
            }
        }
        //console.log("GPS: " + avlRecord.gps)
        console.log("Event ID: " + avlRecord.event_id)
        console.log("Properties Count " + avlRecord.properties_count)
        for (const [key, element] of Object.entries(avlRecord.ioElements)) {
            for (const [property, val] of Object.entries(element)) {
                if (val){
                    console.log(`IO Element ${key} ${property}: ${val}`);
                }
                if (property == "value"){
                    for (const [prop, v] of Object.entries(val)) {
                        console.log(`IO Element ${key} ${property} ${val} ${prop}: ${v}`);
                    }
                }
            }
            //console.log(`IO Element ${key}: ${value}`);
        }
    }

}

ui_inst = new UI()

//var stdin = process.openStdin();



