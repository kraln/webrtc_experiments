/* WebRTC stuff */

var webrc_localstream;

var webrtc_getlocalaudio = function() {
  var constraints = {
    video: false,
    audio: true,
  };

  if(navigator.getUserMedia) {
    navigator.getUserMedia(constraints, webrtc_getUserMediaSuccess, webrtc_error);
  } else {
    console.log("Couldn't get audio stream (unsupported)");
  }
};

webrtc_getUserMediaSuccess = function(stream) {
  webrtc_localstream = stream;
  console.log("Got local audio stream.")
}; 

webrtc_error = function(error) {
  console.warn("error: " + error);
};

webrtc_createoffer = function(session, initiate)
{
  if(!session) return;
  if(!peers[session]) return;
  peers[session].sock = new RTCPeerConnection(ICE_CONFIG);
  console.log("Created session");
  peers[session].sock.onicecandidate = function(event) {
    if(event.candidate != null) {
      console.log("Got ice candidate for session " + session);
      pub('com.kraln.webrtc.ice', [sess_id, session, JSON.stringify(event.candidate)]);
    }
  };

  peers[session].sock.onaddstream = function(stream) 
  {

    peers[session].stream = stream;

    console.log("Peer " + session + "connected, got stream " + peers[session].stream);

    $("#remoteaudio").srcObject = peers[session].stream;
  };
  peers[session].sock.addStream(webrtc_localstream);

  if(initiate)
  {
    console.log("create Offer");
    peers[session].sock.createOffer().then(
      function(offer) {
        console.log('Creating Offer for ' + session);
        peers[session].sock.setLocalDescription(offer).then(
          function() {
            console.log('set local description for ' + session);
            pub('com.kraln.webrtc.call', [sess_id, session, peers[session].sock.localDescription]);
          }).catch(webrtc_error);
      }
    ).catch(webrtc_error);
  }
}
