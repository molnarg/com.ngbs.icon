import Homey from 'homey';
import { PairSession } from 'homey/lib/Driver';
import { broadcastState } from '../../common/client'
import { scan } from '../../common/discovery'
import { connect } from "ngbs-icon";
import ThermostatDevice from './device';

/** Implement the pairing process. */
export default class ThermostatDriver extends Homey.Driver {
  private pollInterval: NodeJS.Timeout | undefined;

  async onInit() {
    this.pollInterval = setInterval(() => this.poll(), 60000);
    this.log('Initialized');
  }

  async onUninit() {
    clearInterval(this.pollInterval!);
    this.log('Uninitialized');
  }

  async poll() {
    try {
      const devices = this.getDevices() as ThermostatDevice[];
      const urls = devices.map(d => d.url);
      for (let [i, url] of urls.entries()) {
        // Only poll once per address
        if (urls.indexOf(url) !== i) await devices[i].poll();
      }
    } catch(e) {
      this.error('Error while polling: ', e);
    }
  }

  async onPair(session: PairSession) {
    this.log('Start pairing')
    let address: string;
    let sysid: string;

    session.setHandler("set_address", async msg => {
      address = msg;
      this.log('Set address to ' + address);
    });

    session.setHandler("set_sysid", async msg => {
      sysid = msg;
      this.log('Set SYSID to ' + sysid);
    });

    // Prefill address and SYSID based on existing devices or network scan
    session.setHandler("prefill", async () => {
      const devices = this.getDevices() as ThermostatDevice[];
      if (devices.length) {
        const url = new URL(devices[0].url);
        sysid = url.username;
        address = url.hostname;
        this.log('Prefill existing address and SYSID:', address, sysid);
        return { address, sysid };
      } else {
        try {
          const result = await scan((percentage) => {
            // This can happen e.g. when the pairing session ends before the scan does
            session.emit('scan', percentage).catch((e: any) => this.log('Error while reporting scan progress', e));
          }, this.log.bind(this));
          if (result) {
            address = result.address;
            sysid = result.sysid;
            return result;
          }
        } catch (e) {
          this.log('Scan failed with error', e);
        }
      }
    });

    session.setHandler("list_devices", async () => {
      try {
        const url = 'service://' + sysid + '@' + address + ':7992';
        this.log('Connecting to ' + url);
        const thermostats = broadcastState(await connect(url).getState()).thermostats;
        this.log('Successfully retrieved ' + thermostats.length + ' thermostats.');
        const devices = thermostats.map((thermostat, index) => ({
          name: thermostat.name || ("Thermostat " + (index + 1)),
          data: {
            url,
            id: thermostat.id,
          },
        }));
        this.log('Devices:', devices);
        return devices;
      } catch (e: any) {
        const code: string = e?.code || e?.data?.code || 'other';
        const error = this.homey.__("pair.address.errors." + code) || e?.message || e?.data?.message || JSON.stringify(e);
        this.error('NGBS client error', code, error, e);
        throw new Error(error);
      }
    });
  }
}

module.exports = ThermostatDriver;
