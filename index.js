let Homebridge; 
const PLUGIN_NAME   = 'homebridge-zigbee2mqtt-dawon-switches';
const PLATFORM_NAME = "DawonSwitch";
const mqtt = require( "mqtt" );


class DawonBtn{
  constructor(device, log, name, idx){
    this.device = device
    this.log = log;
    this.idx = idx;
    this.name = name;
    this.switchOn = false;
    let hap = Homebridge.hap
    this.switchService = new hap.Service.Switch(name);
    this.informationService = new hap.Service.AccessoryInformation()
        .setCharacteristic(hap.Characteristic.Manufacturer, "Dawon")
        .setCharacteristic(hap.Characteristic.Model, "Dawon Switch");
    this.switchService.getCharacteristic(hap.Characteristic.On)
        .on("get", (callback)=>{
          // log.info(`${this.name} get function this.switchOn:${this.switchOn}`)
          if(this.device.getState() === false){
             callback( 'offline' );
          }
          else{
            callback(null, this.switchOn);
          }
        })
        .on("set", (value, callback)=>{
          // log.info(`${this.name} set function this.switchOn:${value} this.idx:${this.idx}`)
          this.device.setState(this.idx, value);
          callback();
        });
  }

  transferState(val){
    if(val != this.switchOn){
      // this.log.info(`transferState ${val}`)
      this.switchOn = val;
      this.switchService.getCharacteristic(Homebridge.hap.Characteristic.On).updateValue(val)
    }
  }

  getServices() {
      return [
          this.informationService,
          this.switchService,
      ];
  }
}


class DawonSwitch{
  constructor(log, config, api){
    if(!config) {return;}

    this.log = log;
    this.api = api;
    this.config = config;
    this.acc = []
    this.stat_acc = {}
    this.topic_status = `${config.baseTopic || 'zigbee2mqtt'}/${config.friendlyName}`
    this.topic_get = `${this.topic_status}/get`
    this.topic_set = `${this.topic_status}/set`

    if(this.config.numButton == 1){
      let btn = new DawonBtn(this, log, config.btnName, 'state');
      this.stat_acc[btn.idx] = btn
      this.acc.push(btn);
    }
    else{
      if(config.btnTopName){
        let btnTop = new DawonBtn(this, log, config.btnTopName, 'state_top');
        this.stat_acc[btnTop.idx] = btnTop
        this.acc.push(btnTop);
      }
      if(this.config.numButton == 3){
        if(config.btnCenterName){
          let btnCenter = new DawonBtn(this, log, config.btnCenterName, 'state_center');
          this.stat_acc[btnCenter.idx] = btnCenter
          this.acc.push(btnCenter);
        }
      }
      if(config.btnBottomName){
        let btnBottom = new DawonBtn(this, log, config.btnBottomName, 'state_bottom');
        this.stat_acc[btnBottom.idx] = btnBottom
        this.acc.push(btnBottom);
      }
    }

    const cid = `DawonSwitch_${config.friendlyName}_${Math.random().toString(16)}`
    const opt = {
      username: config.username,
      password: config.password,
      clientId: cid
    }

    this.lastRecieved = 0;
    this.online = true;

    this.mqttClient = mqtt.connect(config.url || 'mqtt://localhost:1883', opt);
    this.mqttClient.on('error', (err) => { log('MQTT Error:' + err ) });
    this.mqttClient.on('message', (topic, message) => {this.broadcastState(message);});
    var getItems = {}
    for (var key in this.stat_acc){getItems[key] = ''}
    this.getString = JSON.stringify(getItems)

    this.mqttClient.subscribe(this.topic_status)

    // will be deleted
    //log.info(`DawonSwitch ${config.name} initialized.`)
    //log.info(this.topic_status)
    //log.info(this.topic_get)
    //log.info(this.topic_set)
  }

  accessories(callback){
    callback(this.acc);
  };

  broadcastState(message){
    this.lastRecieved = new Date().getTime();
    var rtn = JSON.parse(message.toString());
    // this.log.info(`in broadcastState ${message.toString()}`)
    for(var key in rtn){
      if(this.stat_acc.hasOwnProperty(key)){this.stat_acc[key].transferState(rtn[key] === "ON" ? true:false)}
    }
  };
  getState(){
    if(new Date().getTime() - this.lastRecieved < 600 * 1000){return this.online}
    this.mqttClient.publish(this.topic_get, this.getString);
    // const nt = new Date().getTime();
    // setTimeout(()=>{this.offlineChecker(nt)}, 10000);
    return this.online;
  };
  setState(idx, value){
    // this.log.info("setState() started");
    var setDict = {}
    setDict[idx] = value ? "ON" : "OFF"
    const setString = JSON.stringify(setDict);
    this.mqttClient.publish(this.topic_set, setString);
    // const nt = new Date().getTime();
    // setTimeout(()=>{this.offlineChecker(nt)}, 10000);
  };
  // offlineChecker(_time){
  //   this.online = this.lastRecieved >= _time;
  // };
}

module.exports = (homebridge) => {
  Homebridge = homebridge; 
  Homebridge.registerPlatform(PLUGIN_NAME, PLATFORM_NAME, DawonSwitch);
}
