var chess_svg = d3.select('#chess-grid').append('svg:svg')
					.attr('width', 460).attr('height', 510);
//棋盘边界margin
var out_width = 30;
// 每个格子多宽
var cell_width = 50;
var row_count = 9;
var col_count = 8;
// 棋子大小
var piece_width = 42;

var chess_is_init = true;  //棋盘是不是没有走动过，如果没走动，他人上线就不用重画
var offline_timeout;
/**
 * 获取当前坐标属于棋盘中的第几行几列
 * @param  {} pos 
 * @return {}     
 */
function getGridRowCol(pos){
    var cursorx = pos[0];
    var cursory = pos[1];
    var start_col = Math.floor((cursorx-out_width) / cell_width);
    var start_row = Math.floor((cursory-out_width) / cell_width);
    if (((cursorx-out_width) % cell_width) > (cell_width/2)) {
        start_col++;
    }
    if (((cursory-out_width) % cell_width) > (cell_width/2)) {
        start_row++;
    }
    if(start_row < 0 ) start_row = 0;
    if(start_col < 0) start_col = 0;
    if(start_row > row_count) start_row = row_count;
    if(start_col > col_count) start_col = col_count;
    return [start_row, start_col]
}

/**
 * 获取鼠标当前在棋盘里面的相对坐标
 * @param  {} e 
 * @return {}   
 */
function getCurPosition(e) {  
    var x, y; 
    if (e.pageX != undefined && e.pageY != undefined) {  
      x = e.pageX;
      y = e.pageY; 
    } else {  
      x = e.clientX + document.body.scrollLeft + document.documentElement.scrollLeft;
      y = e.clientY + document.body.scrollTop + document.documentElement.scrollTop;
    }  
    x -= $(chess_svg[0][0]).offset().left;  //兼容firefox
    y -= $(chess_svg[0][0]).offset().top;
    return [x, y];
} 
/**
 * 选中棋子
 * @param  {event} e 
 * @return {bool}   
 */
function gameClickHandler(e){
	if(is_waiting){
        return false;
    }
	var pos = getCurPosition(e);
	var rowcol = getGridRowCol(pos);
    var row = rowcol[0];
    var col = rowcol[1];
    // 如果之前有选中的，且和现在不同位置，则视为走棋
    if(ChessPiece.ChoosenPieceKey 
    	&& ( ChessPiece.ChoosenPieceKey.row != row || ChessPiece.ChoosenPieceKey.col != col )){
    	var piece = ChessPiece.ChoosenPieceKey;
        org_row = piece.row;
        org_col = piece.col;
        var canmove = new ChessMove(piece.row, piece.col, row, col);
        if(canmove.canMove()){
            piece.moveTo(row, col);
            piece.zoomOut();
        	ChessPiece.ChoosenPieceKey = null;
            // 发送数据
            gamemove(org_row, org_col, row, col);
        }else{  // 违反规则，不能走
            // 如果选中了自己的棋子，当成是重新选择棋子
            if (ChessPiece.PiecesMap[row+'-'+col] && ChessPiece.PiecesMap[row+'-'+col].color == my_piece_color) {
                piece._clearZoomCross();
                var curp = ChessPiece.PiecesMap[row+'-'+col];
                curp.zoomIn();
                ChessPiece.ChoosenPieceKey = curp;
            }
        }

    }else
    // 如果之前有选中的，且和现在相同位置，则视为取消选择
    if(ChessPiece.ChoosenPieceKey && ChessPiece.ChoosenPieceKey.row == row 
    	&& ChessPiece.ChoosenPieceKey.col == col ){ 
    	ChessPiece.PiecesMap[row+'-'+col].zoomOut();
    	ChessPiece.ChoosenPieceKey = null;
    }else
    // 之前没有选中的，如果现在选择有棋子且是自己的颜色，则选中它
    if(!ChessPiece.ChoosenPieceKey){
    	if (ChessPiece.PiecesMap[row+'-'+col] ) {  // 有棋子
    		var curp = ChessPiece.PiecesMap[row+'-'+col];
    		if(curp.color == my_piece_color){
    			curp._clearZoomCross();
	    		curp.zoomIn();
	    		ChessPiece.ChoosenPieceKey = curp;
    		}
    	}
    }
}

//哪一方该下棋的标记
function initStartSign(){
    $('#piece_sign_top').removeClass('gamemove-status');
    $('#piece_sign_bottom').removeClass('gamemove-status');
    var piece_signs = $('#piece_sign_top');
    if(my_piece_color == 1){
        piece_signs = $('#piece_sign_bottom');   
    }
    piece_signs.addClass('gamemove-status');
}
/**
 * 发送聊天
 * @return {} 
 */
function sendchat(){
    var content = $('#chat-input').val();
    $('#chat-input').val('');            
    if (!content || room_status != 1) return;
    $('#chat-div ul').append('<li class="mychat-li"></li>');
    $('#chat-div ul li:last-child').text(content);
    $('#chat-div ul').scrollTop($('#chat-div ul')[0].scrollHeight);
    gamesocket.send(JSON.stringify({
        room: room_name,
        content: content,
        'type':'on_chat',
    }));
}

/**
 * 下棋动作
 * @param  {array} from 
 * @param  {array} to
 * @return {bool}     
 */
function gamemove(x1,y1,x2,y2){
    // 如果我是黑方，还得把我自己看到的坐标，转换成红方的立场下相应坐标，再发给服务器
    if(my_piece_color == 2){
        x1 = row_count - x1;
        y1 = col_count - y1;
        x2 = row_count - x2;
        y2 = col_count - y2;
    }
    chess_is_init = false;
    var data = JSON.stringify({
        room: room_name,
        row1: x1,
        col1: y1,
        row2: x2,
        col2: y2,
        'type':'on_gamemove',
    });
    gamesocket.send(data);
    is_waiting = true;
    d3.select('#chess-grid svg').style('cursor','default')
    $('#piece_sign_bottom').removeClass('gamemove-status');
    $('#piece_sign_top').addClass('gamemove-status');
}

/**
 * 对方上线
 * @param  {string} msg 
 * @return {bool}     
 */
function on_online(msg){

}
/**
 * 对方离线
 * @param  {string} msg 
 * @return {bool}     
 */
function on_offline(msg){
    is_waiting = true;
    room_status = 0;
    $('#status-span').text('对方离线');
    $('#game-canvas').css('cursor', 'default');
    $('#piece_sign_top').removeClass('gamemove-status');
    $('#piece_sign_bottom').removeClass('gamemove-status');
    $('#alert-title').text('对方离线');
    offline_timeout = setTimeout(function(){
       $('#alert-model-dom').data('id', 0).modal('show');
    }, 2000);
}
/**
 * 对方走一步棋
 * @param  {string} msg 
 * @return {bool}     
 */
function on_gamemove(msg){
    chess_is_init = false;
    x1 = parseInt(msg.row1);
    y1 = parseInt(msg.col1);
    x2 = parseInt(msg.row2);
    y2 = parseInt(msg.col2);

    // 如果我是黑方，还得把我自己看到的坐标，转换成红方的立场下相应坐标
    if(my_piece_color == 2){
        x1 = row_count - x1;
        y1 = col_count - y1;
        x2 = row_count - x2;
        y2 = col_count - y2;
    }

    var movep = ChessPiece.PiecesMap[x1+'-'+y1];
    movep._clearZoomCross();  // 清掉我这边的标志
    movep.zoomIn();
    movep.moveTo(x2, y2);

    d3.select('#chess-grid svg').style('cursor','pointer');
    $('#piece_sign_top').removeClass('gamemove-status');
    $('#piece_sign_bottom').addClass('gamemove-status');
    is_waiting = false;
}
/**
 * 开始游戏
 * @param  {string} msg 
 * @return {bool}     
 */
function on_gamestart(msg){
    clearTimeout(offline_timeout);
    is_waiting = (my_piece_color==2) ? true : false;
    room_status = 1;
    $('#status-span').text('对方上线，游戏开始');

    if(!chess_is_init){
        d3.selectAll('#chess-grid svg *').remove();
        ChessPiece.PiecesMap = {};
        initDraw();  //重画棋盘
        d3.select('.zoomnode').remove();
    }

    if(my_piece_color == 1){  //黑先白后
        $('#chess-grid svg').css('cursor', 'pointer');
    }else{
        $('#chess-grid svg').css('cursor', 'default');
    }
    initStartSign();
}
/**
 * 游戏结束
 * @param  {string} msg 
 * @return {bool}     
 */
function on_gameover(msg){
    is_waiting = true;
    room_status = 2;
    $('#status-span').text('游戏结束');
    $('#piece_sign_top').removeClass('gamemove-status');
    $('#piece_sign_bottom').removeClass('gamemove-status');
    $('#chess-grid svg').css('cursor', 'default'); 

    $('#alert-title').text('游戏结束');
    $('#alert-model-dom').data('id', 0).modal('show');
}
/**
 * 聊天
 * @param  {string} msg 
 * @return {bool}     
 */
function on_chat(msg){
    $('#chat-div ul').append('<li class="hischat-li"></li>');
    $('#chat-div ul li:last-child').text(msg.content);
    $('#chat-div ul').scrollTop($('#chat-div ul')[0].scrollHeight);
}

window.onbeforeunload = function () {
    gamesocket.close();
    // event.returnValue = "You will lose any unsaved content";
}
/**
 * 初始化画棋盘
 * @return {} 
 */
function initDraw(){
    chess_is_init = true;
    var chess_grid = new ChessGrid();
    chess_grid.drawAllGrid();

    var my_piece_pos = [
        [6,0,'bing'],
        [6,2, 'bing'],
        [6,4, 'bing'],
        [6,6, 'bing'],
        [6,8, 'bing'],
        [7,1,'pao'],
        [7,7,'pao'],
        [9,0,'che'],
        [9,1,'ma'],
        [9,2,'xiang'],
        [9,3,'shi'],
        [9,4,'king'],
        [9,5,'shi'],
        [9,6,'xiang'],
        [9,7,'ma'],
        [9,8,'che'],
    ];
    for (i=0; i<my_piece_pos.length; i++){
        var info = my_piece_pos[i];
        var piess = new ChessPiece(info[0], info[1], info[2], my_piece_color);
        piess.addAndShow();
    }

    var his_piece_pos = [
        [0,0,'che'],
        [0,1,'ma'],
        [0,2,'xiang'],
        [0,3,'shi'],
        [0,4,'king'],
        [0,5,'shi'],
        [0,6,'xiang'],
        [0,7,'ma'],
        [0,8,'che'],
        [2,1,'pao'],
        [2,7,'pao'],
        [3,0,'bing'],
        [3,2,'bing'],
        [3,4,'bing'],
        [3,6,'bing'],
        [3,8,'bing'],
    ];
    for (i=0; i<his_piece_pos.length; i++){
        var info = his_piece_pos[i];
        var piess = new ChessPiece(info[0], info[1], info[2], his_piece_color);
        piess.addAndShow();
    }
}

$(function() {
    initDraw();
    chess_svg[0][0].addEventListener("click", gameClickHandler, false);

    if(room_status != 0){
        initStartSign();
    }
    if(is_waiting ){
        $('#chess-grid svg').css('cursor', 'default');
    }

    var WebSocket = window.WebSocket || window.MozWebSocket;
        if (WebSocket) {
            try {
                gamesocket = new WebSocket(wsurl);
            } catch (e) {
                alert(e)
            }
    }

    if (gamesocket) {
        gamesocket.onopen = function(){  
            //gamesocket.send(JSON.stringify({name:"yes"}));
        }  
        gamesocket.onmessage = function(event) {
            // console.log(event.data);
            var msg = JSON.parse(event.data)
            switch(msg.type){
                case 'online':
                    on_online(msg);
                    break;
                case 'offline':
                    on_offline(msg);
                    break;
                case 'on_gamestart':
                    on_gamestart(msg);
                    break;
                case 'on_gamemove':
                    on_gamemove(msg);
                    break;
                case 'on_gameover':
                    on_gameover(msg);
                    break;
                case 'on_chat':
                    on_chat(msg);
                    break;
                default:
                    break;
            }
        }
    }
});