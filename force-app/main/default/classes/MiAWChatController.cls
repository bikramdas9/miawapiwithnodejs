public with sharing class MIAWChatController {
    
    // Hardcoded configuration
    private static final String BASE_URL = 'https://eaton--prodbackup.sandbox.my.salesforce-scrt.com';
    private static final String ORG_ID = '00DO2000007hSpp';
    private static final String ES_DEVELOPER_NAME = 'Test_MIAW_API';
    private static final String CAPABILITIES_VERSION = '1';
    private static final String PLATFORM = 'Web';
    private static final String APP_NAME = 'customClientDemo';
    private static final String CLIENT_VERSION = '1.0.0';
    private static final String LANGUAGE = 'en_US';
    
    // Wrapper classes for API responses
    public class ApiResponse {
        @AuraEnabled public Boolean success { get; set; }
        @AuraEnabled public String message { get; set; }
        @AuraEnabled public Object data { get; set; }
        
        public ApiResponse(Boolean success, String message, Object data) {
            this.success = success;
            this.message = message;
            this.data = data;
        }
    }
    
    public class AccessTokenResponse {
        @AuraEnabled public String accessToken { get; set; }
        @AuraEnabled public String deviceId { get; set; }
        @AuraEnabled public String clientSessionId { get; set; }
    }
    
    public class ConversationResponse {
        @AuraEnabled public String conversationId { get; set; }
        @AuraEnabled public String status { get; set; }
    }
    
    public class ChatSession {
        @AuraEnabled public String accessToken { get; set; }
        @AuraEnabled public String conversationId { get; set; }
        @AuraEnabled public String deviceId { get; set; }
        @AuraEnabled public String clientSessionId { get; set; }
        @AuraEnabled public String status { get; set; }
        @AuraEnabled public String firstName { get; set; }
        @AuraEnabled public String lastName { get; set; }
        @AuraEnabled public String email { get; set; }
    }
    
    @AuraEnabled
    public static ApiResponse generateAccessToken(String firstName, String lastName, String email) {
        try {
            HttpRequest req = new HttpRequest();
            req.setEndpoint(BASE_URL + '/iamessage/api/v2/authorization/unauthenticated/access-token');
            req.setMethod('POST');
            req.setHeader('Content-Type', 'application/json');
            
            Map<String, Object> requestBody = new Map<String, Object>{
                'orgId' => ORG_ID,
                'esDeveloperName' => ES_DEVELOPER_NAME,
                'capabilitiesVersion' => CAPABILITIES_VERSION,
                'platform' => PLATFORM,
                'context' => new Map<String, Object>{
                    'appName' => APP_NAME,
                    'clientVersion' => CLIENT_VERSION
                }
            };
            
            req.setBody(JSON.serialize(requestBody));
            req.setTimeout(30000);
            
            Http http = new Http();
            HttpResponse res = http.send(req);
            
            if (res.getStatusCode() == 200) {
                Map<String, Object> responseData = (Map<String, Object>) JSON.deserializeUntyped(res.getBody());
                
                AccessTokenResponse tokenResponse = new AccessTokenResponse();
                tokenResponse.accessToken = (String) responseData.get('accessToken');
                tokenResponse.deviceId = (String) responseData.get('deviceId');
                tokenResponse.clientSessionId = (String) responseData.get('clientSessionId');
                
                // Store session data
                ChatSession session = new ChatSession();
                session.accessToken = tokenResponse.accessToken;
                session.deviceId = tokenResponse.deviceId;
                session.clientSessionId = tokenResponse.clientSessionId;
                session.firstName = firstName;
                session.lastName = lastName;
                session.email = email;
                session.status = 'TOKEN_GENERATED';
                
                storeChatSession(session);
                
                return new ApiResponse(true, 'Access token generated successfully', tokenResponse);
            } else {
                return new ApiResponse(false, 'Failed to generate access token: ' + res.getBody(), null);
            }
            
        } catch (Exception e) {
            return new ApiResponse(false, 'Error generating access token: ' + e.getMessage(), null);
        }
    }
    
    @AuraEnabled
    public static ApiResponse createConversation(String sessionId) {
        try {
            ChatSession session = getChatSession(sessionId);
            if (session == null) {
                return new ApiResponse(false, 'Session not found', null);
            }
            
            String conversationId = generateConversationId();
            
            HttpRequest req = new HttpRequest();
            req.setEndpoint(BASE_URL + '/iamessage/api/v2/conversation');
            req.setMethod('POST');
            req.setHeader('Content-Type', 'application/json');
            req.setHeader('Authorization', 'Bearer ' + session.accessToken);
            
            Map<String, Object> requestBody = new Map<String, Object>{
                'conversationId' => conversationId,
                'routingAttributes' => new Map<String, Object>{
                    'FName' => session.firstName,
                    'LName' => session.lastName,
                    'CustomerEmail' => session.email
                },
                'esDeveloperName' => ES_DEVELOPER_NAME,
                'language' => LANGUAGE
            };
            
            req.setBody(JSON.serialize(requestBody));
            req.setTimeout(30000);
            
            Http http = new Http();
            HttpResponse res = http.send(req);
            
            if (res.getStatusCode() == 202 || res.getStatusCode() == 201) {
                session.conversationId = conversationId;
                session.status = 'CONVERSATION_CREATED';
                storeChatSession(session);
                
                ConversationResponse convResponse = new ConversationResponse();
                convResponse.conversationId = conversationId;
                convResponse.status = 'CREATED';
                
                return new ApiResponse(true, 'Conversation created successfully', convResponse);
            } else {
                return new ApiResponse(false, 'Failed to create conversation: ' + res.getBody(), null);
            }
            
        } catch (Exception e) {
            return new ApiResponse(false, 'Error creating conversation: ' + e.getMessage(), null);
        }
    }
    
    @AuraEnabled
    public static ApiResponse sendMessage(String sessionId, String messageText) {
        try {
            ChatSession session = getChatSession(sessionId);
            if (session == null || String.isBlank(session.conversationId)) {
                return new ApiResponse(false, 'Invalid session or conversation', null);
            }
            
            String messageId = generateMessageId();
            
            HttpRequest req = new HttpRequest();
            req.setEndpoint(BASE_URL + '/iamessage/api/v2/conversation/' + session.conversationId + '/message');
            req.setMethod('POST');
            req.setHeader('Content-Type', 'application/json');
            req.setHeader('Authorization', 'Bearer ' + session.accessToken);
            req.setHeader('x-conversation-id', session.conversationId);
            
            Map<String, Object> requestBody = new Map<String, Object>{
                'message' => new Map<String, Object>{
                    'id' => messageId,
                    'messageType' => 'StaticContentMessage',
                    'staticContent' => new Map<String, Object>{
                        'formatType' => 'Text',
                        'text' => messageText
                    }
                },
                'esDeveloperName' => ES_DEVELOPER_NAME,
                'isNewMessagingSession' => false,
                'routingAttributes' => new Map<String, Object>{
                    'FName' => session.firstName,
                    'LName' => session.lastName,
                    'CustomerEmail' => session.email
                },
                'language' => ''
            };
            
            req.setBody(JSON.serialize(requestBody));
            req.setTimeout(30000);
            
            Http http = new Http();
            HttpResponse res = http.send(req);
            
            if (res.getStatusCode() == 202 || res.getStatusCode() == 201) {
                return new ApiResponse(true, 'Message sent successfully', new Map<String, Object>{
                    'messageId' => messageId,
                    'status' => 'SENT'
                });
            } else {
                return new ApiResponse(false, 'Failed to send message: ' + res.getBody(), null);
            }
            
        } catch (Exception e) {
            return new ApiResponse(false, 'Error sending message: ' + e.getMessage(), null);
        }
    }
    
    @AuraEnabled
    public static ApiResponse endConversation(String sessionId) {
        try {
            ChatSession session = getChatSession(sessionId);
            if (session == null || String.isBlank(session.conversationId)) {
                return new ApiResponse(false, 'Invalid session or conversation', null);
            }
            
            HttpRequest req = new HttpRequest();
            req.setEndpoint(BASE_URL + '/iamessage/api/v2/conversation/' + session.conversationId + '?esDeveloperName=' + ES_DEVELOPER_NAME);
            req.setMethod('DELETE');
            req.setHeader('Authorization', 'Bearer ' + session.accessToken);
            req.setTimeout(30000);
            
            Http http = new Http();
            HttpResponse res = http.send(req);
            
            // Clean up session regardless of API response
            clearChatSession(sessionId);
            
            if (res.getStatusCode() == 200 || res.getStatusCode() == 204) {
                return new ApiResponse(true, 'Conversation ended successfully', null);
            } else {
                return new ApiResponse(true, 'Conversation ended locally (API response: ' + res.getStatusCode() + ')', null);
            }
            
        } catch (Exception e) {
            // Clean up session even on error
            clearChatSession(sessionId);
            return new ApiResponse(true, 'Conversation ended locally due to error: ' + e.getMessage(), null);
        }
    }
    
    @AuraEnabled
    public static ChatSession getChatSessionData(String sessionId) {
        return getChatSession(sessionId);
    }
    
    @AuraEnabled
    public static String getSSEEndpoint(String sessionId) {
        ChatSession session = getChatSession(sessionId);
        if (session != null && !String.isBlank(session.accessToken)) {
            return BASE_URL + '/eventrouter/v1/sse';
        }
        return null;
    }
    
    // Static variable to store sessions in memory
    private static Map<String, ChatSession> sessionStore = new Map<String, ChatSession>();
    private static Map<String, DateTime> sessionTimestamps = new Map<String, DateTime>();
    
    // Helper methods using static variables
    private static void storeChatSession(ChatSession session) {
        try {
            sessionStore.put(session.clientSessionId, session);
            sessionTimestamps.put(session.clientSessionId, System.now());
            
            // Clean up old sessions to prevent memory issues (keep only last 10 sessions)
            if (sessionStore.size() > 10) {
                cleanupOldSessions();
            }
            
        } catch (Exception e) {
            System.debug('Error storing session: ' + e.getMessage());
        }
    }
    
    private static ChatSession getChatSession(String sessionId) {
        try {
            // Check if session exists and is not too old (2 hours)
            if (sessionStore.containsKey(sessionId) && sessionTimestamps.containsKey(sessionId)) {
                DateTime sessionTime = sessionTimestamps.get(sessionId);
                DateTime cutoffTime = System.now().addHours(-2);
                
                if (sessionTime >= cutoffTime) {
                    // Update last activity timestamp
                    sessionTimestamps.put(sessionId, System.now());
                    return sessionStore.get(sessionId);
                } else {
                    // Session expired, remove it
                    sessionStore.remove(sessionId);
                    sessionTimestamps.remove(sessionId);
                }
            }
            
        } catch (Exception e) {
            System.debug('Error retrieving session: ' + e.getMessage());
        }
        return null;
    }
    
    private static void clearChatSession(String sessionId) {
        try {
            sessionStore.remove(sessionId);
            sessionTimestamps.remove(sessionId);
        } catch (Exception e) {
            System.debug('Error clearing session: ' + e.getMessage());
        }
    }
    
    // Helper method to clean up old sessions based on timestamp
    private static void cleanupOldSessions() {
        try {
            DateTime cutoffTime = System.now().addHours(-2);
            List<String> sessionsToRemove = new List<String>();
            
            // Find expired sessions
            for (String sessionId : sessionTimestamps.keySet()) {
                if (sessionTimestamps.get(sessionId) < cutoffTime) {
                    sessionsToRemove.add(sessionId);
                }
            }
            
            // Remove expired sessions
            for (String sessionId : sessionsToRemove) {
                sessionStore.remove(sessionId);
                sessionTimestamps.remove(sessionId);
            }
            
            // If still too many sessions, remove oldest ones
            if (sessionStore.size() > 10) {
                List<String> sortedSessions = new List<String>(sessionTimestamps.keySet());
                // Sort by timestamp (oldest first) - simple bubble sort for small datasets
                for (Integer i = 0; i < sortedSessions.size() - 1; i++) {
                    for (Integer j = 0; j < sortedSessions.size() - i - 1; j++) {
                        if (sessionTimestamps.get(sortedSessions[j]) > sessionTimestamps.get(sortedSessions[j + 1])) {
                            String temp = sortedSessions[j];
                            sortedSessions[j] = sortedSessions[j + 1];
                            sortedSessions[j + 1] = temp;
                        }
                    }
                }
                
                // Remove oldest sessions to keep only 10
                Integer sessionsToKeep = 10;
                for (Integer i = 0; i < sortedSessions.size() - sessionsToKeep; i++) {
                    String sessionId = sortedSessions[i];
                    sessionStore.remove(sessionId);
                    sessionTimestamps.remove(sessionId);
                }
            }
            
        } catch (Exception e) {
            System.debug('Error during cleanup: ' + e.getMessage());
        }
    }
    
    // Utility method to get session count and info for debugging
    @AuraEnabled
    public static Map<String, Object> getSessionInfo() {
        Map<String, Object> info = new Map<String, Object>();
        info.put('activeSessionCount', sessionStore.size());
        info.put('sessionIds', new List<String>(sessionStore.keySet()));
        return info;
    }
    
    private static String generateConversationId() {
        return String.valueOf(UUID.RandomUUID());
    }
    
    private static String generateMessageId() {
        return String.valueOf(UUID.RandomUUID());
    }
}