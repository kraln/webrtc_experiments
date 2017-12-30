/* WAMP stuff */  
/* WAMP url. Currently running locally in docker */
var t1; // heartbeat timer
var peers = {};
/*
Peer {
sess_id = uuid of peer session
name = name of peer session
lastheartbeat = last time the heartbeat was seen
sock = RTCConnection
stream = Stream Object
}
*/

updatePeerList=function()
{
  var peerList = "Peers: ";
  var removeList = [];
  Object.keys(peers).forEach(function(peer_key) {
    peer = peers[peer_key];
    peerList = peerList + "<br />"+ peer.name + " [" + peer.sess_id + "] " + (Date.now() - peer.lastheartbeat);

    /* remove if over 15 seconds old */
    if ((Date.now() - peer.lastheartbeat) > 15000)
    {
      removeList.push(peer_key);
    }
  });

  removeList.forEach(function(peer_key) {
    console.log("Pruning expired peer " + peer_key);
    delete peers[peer_key];
  });

  $("#peers").html(peerList);

};

addPeer = function(psess_id, initiate)
{
  console.log("Adding previously unseen peer " + psess_id);
  peers[psess_id] = {};
  peer = peers[psess_id];
  peer.sess_id = psess_id;
  peer.name = psess_id.substring(0,5);
  peer.lastheartbeat = Date.now()

  webrtc_createoffer(psess_id, initiate);
  return peer;

};

connection.onopen = function (session, details) {
  console.log("Connected");

  /* set up callbacks for events */

  /* on_connect callback */
  function on_heartbeat (args) {
    // console.log("on_heartbeat() event received from sess_id " + args[0]);

    peer = peers[args[0]];

    if(!peer)
    {
      peer = addPeer(args[0], true);
    }             

    peer.lastheartbeat = Date.now()
  }

  /* when a peer wants to reach out */
  function on_call(args) {
    if(args[1] != sess_id)
    {
      console.log("on_call() event received, but it was not for me");
      return;
    } else {
      console.log("on_call() event received from " + args[0] + " for peer "+ args[1]); //+ " with info "+ args[2]);
    }


    if(!peers[args[0]])
    {
      console.log("Possible timing issue: call from unknown peer.");
      addPeer(args[0], false);
    }

    offer = args[2]; // JSON.parse(args[2]);

    console.log("Setting remote description...");
    peers[args[0]].sock.setRemoteDescription(offer).then(function() 
      {
        console.log("Got offer, making answer...");
        return peers[args[0]].sock.createAnswer();
      }).then(function(answer)
        {
          console.log("Created Answer, setting local description");
          return peers[args[0]].sock.setLocalDescription(answer);
        }).then(function() 
          {
            console.log("set local description for answer, signalling");
            pub('com.kraln.webrtc.accept', [sess_id, args[0], peers[args[0]].sock.localDescription]);
          }).catch(webrtc_error);
  }


/* where a peer has accepted our call */
function on_accept(args)
{
  if(args[1] != sess_id)
  {
    console.log("on_accept() event received, but it was not for me");
    return;
  } else {
    console.log("on_accept() event received from " + args[0] + " for peer "+ args[1]); // + " with info " + args[2]);
  }

  if(!peers[args[0]])
  {
    console.warn("Timing issue: answer from unknown peer!");
    return;
  }

  accept = args[2]; //JSON.parse(args[2]);
  console.log("Setting remote description to answer...");
  peers[args[0]].sock.setRemoteDescription(answer).then(function() 
  {
    console.log("Done!");
  }).catch(webrtc_error);
   
}

/* where a peer has an ice candidate */
function on_ice(args)
{
  if(args[1] != sess_id)
  {
    console.log("on_ice() event received, but it was not for me");
    return;
  } else {
    console.log("on_ice() event received from " + args[0] + " for peer "+ args[1] + " with info " + args[2]);
  }
  webrtc_peerConnection.addIceCandidate(new RTCIceCandidate(args[1])).catch(webrtc_error);
}

/* on_rename callback */
function on_rename(args) {
  peer = peers[args[0]];
  if(!peer)
  {
    console.log("Peer not found");
    return;
  }

  console.log("on_rename() event received for sess_id "+ args[0] + ", old name=" + peer.name + "new name =" + args[1]);
  peers[args[0]].name = args[1];
}

/* subscribe to topics */
session.subscribe('com.kraln.webrtc.heartbeat', on_heartbeat).then(
  function (sub) {
    console.log('subscribed to heartbeat topic');
  },
  function (err) {
    console.log('failed to subscribe to heartbeat topic', err);
  }
);

session.subscribe('com.kraln.webrtc.rename', on_rename).then(

  function (sub) {
    console.log('subscribed to rename topic');
  },
  function (err) {
    console.log('failed to subscribe to rename topic', err);
  }

);

session.subscribe('com.kraln.webrtc.ice', on_ice).then(
  function (sub) {
    console.log('subscribed to ice topic');
  },
  function (err) {
    console.log('failed to subscribe to ice topic', err);
  }

);
session.subscribe('com.kraln.webrtc.call', on_call).then(
  function (sub) {
    console.log('subscribed to call topic');
  },
  function (err) {
    console.log('failed to subscribe to call topic', err);
  }
);
session.subscribe('com.kraln.webrtc.accept', on_accept).then(
  function (sub) {
    console.log('subscribed to accept topic');
  },
  function (err) {
    console.log('failed to subscribe to accept topic', err);
  }
);


// PUBLISH a heartbeat event periodically
//
t1 = setInterval(function () {
  session.publish('com.kraln.webrtc.heartbeat', [sess_id]); 
  updatePeerList();
  //console.log("published heartbeat");
}, HEARTBEAT_INTERVAL);


pub = function(addr, args)
{
  session.publish(addr, args);
};


};

// fired when connection was lost (or could not be established)
//
connection.onclose = function (reason, details) {
  console.log("Connection lost: " + reason);
  if (t1) {
    clearInterval(t1);
    t1 = null;
  }
}


