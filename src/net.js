var PeerGroup = require('bitcoin-net').PeerGroup
var Blockchain = require('blockchain-spv')
var createDb = require('./common.js').createDb
try {
  var wrtc = require('wrtc')
} catch (err) {
  try {
    wrtc = require('electron-webrtc')
  } catch (err) {}
}

module.exports = function (params, test) {
  var peers
  var numPeers = 2

  test('networking', (t) => {
    t.test('create PeerGroup', (t) => {
      try {
        peers = new PeerGroup(params.net, { numPeers, wrtc })
        t.pass('did not throw')
        t.ok(peers, 'got PeerGroup')
        peers.on('error', (err) => t.error(err))
      } catch (err) {
        t.error(err, 'error thrown')
      }
      t.end()
    })

    t.test('connect to peers', (t) => {
      var onPeer = (peer) => {
        t.ok(peer, `connected to peer ${peers.peers.length}/${numPeers}`)
        if (peers.peers.length < numPeers) return
        peers.removeListener('peer', onPeer)
        t.end()
      }
      peers.on('peer', onPeer)
      peers.connect()
    })

    t.test('blockchain download', (t) => {
      var db = createDb()
      var chain = new Blockchain(params.blockchain, db)
      var start = chain.getTip()
      var syncN = 3000
      chain.on('error', (err) => t.error(err))

      var locators = chain.createLocatorStream()
      var headers = peers.createHeaderStream()
      var onBlock = (block) => {
        var i = block.height - start.height
        if (i % 100 === 0) {
          t.ok(block, `sync progress: ${i}/${syncN}`)
        }
        if (i < syncN) return
        t.pass('done syncing')
        chain.removeListener('block', onBlock)
        headers.once('end', () => {
          t.pass('HeaderStream ended')
          t.end()
        })
        headers.end()
      }
      chain.on('block', onBlock)
      locators.pipe(headers).pipe(chain.createWriteStream())
    })

    t.test('disconnect', (t) => {
      peers.close((err) => {
        t.error(err, 'no error')
        t.pass('disconnected')
        t.end()
      })
    })

    t.end()
  })
}
